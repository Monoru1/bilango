import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/http/app';
import { DevPushTransport } from '../src/providers';
import { ScheduledJobs, startScheduler, type JobSummary } from '../src/services/jobs';
import { DbPushSender, PUSH_MAX_ACTIVE_PER_USER, PUSH_MAX_FAILURES, PushService } from '../src/services/push';
import { DAY_MS, expectCode, makeDeps, mkTeam, mkUser, payFor, reportInput, services, T0, type Ctx } from './helpers';

let ctx: Ctx;
beforeEach(async () => {
  ctx = await makeDeps();
});

const KEYS = { p256dh: 'BPublicKeyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', auth: 'authSecret12345' };
const sub = (n: number, keys = KEYS) => ({ endpoint: `https://push.example.test/send/${n}`, keys });
const rows = async (userId: string) =>
  (await ctx.db.query<{ endpoint: string; revoked_at: Date | null; failure_count: number; last_success_at: Date | null }>(
    'select endpoint, revoked_at, failure_count, last_success_at from push_subscriptions where user_id = $1 order by created_at, endpoint',
    [userId],
  )).rows;

describe('enregistrement des abonnements Web Push', () => {
  it('enregistre un abonnement et reste idempotent sur le même point d\'accès', async () => {
    const u = await mkUser(ctx, 'Awa');
    const push = new PushService(ctx.deps);
    await push.register(u.user, u.deviceRowId, sub(1), 'Mozilla/5.0');
    await push.register(u.user, u.deviceRowId, sub(1), 'Mozilla/5.0');
    expect(await rows(u.user.id)).toHaveLength(1);
  });

  it('refuse de reprendre le point d\'accès d\'un autre compte avec des clés différentes, mais l\'accepte avec les mêmes clés', async () => {
    const a = await mkUser(ctx, 'A');
    const b = await mkUser(ctx, 'B');
    const push = new PushService(ctx.deps);
    await push.register(a.user, a.deviceRowId, sub(1), undefined);
    // B connaît (hypothétiquement) l'endpoint de A mais pas ses clés : refus, A garde son abonnement.
    await expectCode(push.register(b.user, b.deviceRowId, sub(1, { p256dh: 'BAttackerKeyBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', auth: 'attackerAuth123' }), undefined), 'conflict');
    expect(await rows(b.user.id)).toHaveLength(0);
    expect(await rows(a.user.id)).toHaveLength(1);
    // Même navigateur, autre compte (clés identiques) : l'abonnement change de propriétaire.
    await push.register(b.user, b.deviceRowId, sub(1), undefined);
    expect(await rows(b.user.id)).toHaveLength(1);
    expect(await rows(a.user.id)).toHaveLength(0); // la ligne a été réaffectée à B : A ne reçoit plus rien sur ce navigateur
  });

  it('ne conserve que les abonnements actifs les plus récents', async () => {
    const u = await mkUser(ctx, 'Awa');
    const push = new PushService(ctx.deps);
    for (let i = 1; i <= PUSH_MAX_ACTIVE_PER_USER + 2; i++) {
      ctx.clock.advance(1000);
      await push.register(u.user, u.deviceRowId, sub(i), undefined);
    }
    const active = (await rows(u.user.id)).filter((r) => r.revoked_at === null);
    expect(active).toHaveLength(PUSH_MAX_ACTIVE_PER_USER);
    expect(active.some((r) => r.endpoint.endsWith('/1'))).toBe(false); // le plus ancien est révoqué
  });

  it('un retrait ne touche que les abonnements de l\'appelant', async () => {
    const a = await mkUser(ctx, 'A');
    const b = await mkUser(ctx, 'B');
    const push = new PushService(ctx.deps);
    await push.register(a.user, a.deviceRowId, sub(1), undefined);
    await push.unregister(b.user, sub(1).endpoint);
    expect((await rows(a.user.id))[0]!.revoked_at).toBeNull();
    await push.unregister(a.user, sub(1).endpoint);
    expect((await rows(a.user.id))[0]!.revoked_at).not.toBeNull();
  });
});

describe('livraison Web Push (DbPushSender)', () => {
  const make = () => {
    const transport = new DevPushTransport();
    return { transport, sender: new DbPushSender(ctx.db, ctx.clock, transport) };
  };
  const register = async (name: string, n: number) => {
    const u = await mkUser(ctx, name);
    await new PushService(ctx.deps).register(u.user, u.deviceRowId, sub(n), undefined);
    return u;
  };

  it('livre à tous les abonnements actifs de l\'utilisateur et seulement à eux', async () => {
    const { transport, sender } = make();
    const a = await register('A', 1);
    await new PushService(ctx.deps).register(a.user, a.deviceRowId, sub(2), undefined);
    await register('B', 3);
    await sender.sendToUser(a.user.id, { type: 'reminder', businessName: 'Boutique' });
    expect(transport.sent.map((s) => s.target.endpoint).sort()).toEqual([sub(1).endpoint, sub(2).endpoint]);
    expect((await rows(a.user.id)).every((r) => r.last_success_at !== null)).toBe(true);
  });

  it('n\'envoie pas au nouvel appareil quand il est exclu (alerte « nouvel appareil » à l\'ANCIEN appareil, §9.2)', async () => {
    const { transport, sender } = make();
    const u = await mkUser(ctx, 'Awa');
    const newDevice = (await ctx.db.query<{ id: string }>('insert into devices(user_id, device_key, first_seen_at, last_seen_at) values ($1,$2,$3,$3) returning id', [u.user.id, 'device-new-xxxxxxxx', new Date(ctx.clock.now()).toISOString()])).rows[0]!;
    const push = new PushService(ctx.deps);
    await push.register(u.user, u.deviceRowId, sub(1), undefined); // ancien appareil
    await push.register(u.user, newDevice.id, sub(2), undefined); // nouvel appareil
    await sender.sendToUser(u.user.id, { type: 'new_device' }, { excludeDeviceId: newDevice.id });
    expect(transport.sent.map((s) => s.target.endpoint)).toEqual([sub(1).endpoint]);
    // Un abonnement sans appareil rattaché reste notifié (device_id nul : on ne peut pas affirmer que c'est le nouvel appareil).
    await ctx.db.query('update push_subscriptions set device_id = null where endpoint = $1', [sub(2).endpoint]);
    transport.sent.length = 0;
    await sender.sendToUser(u.user.id, { type: 'new_device' }, { excludeDeviceId: newDevice.id });
    expect(transport.sent).toHaveLength(2);
  });

  it('ne transmet que type / nom du business / badge : aucun montant ne peut partir', async () => {
    const { transport, sender } = make();
    const a = await register('A', 1);
    // Un appelant (ou une future régression) qui glisserait un montant dans la charge utile :
    await sender.sendToUser(a.user.id, { type: 'report_sent', businessName: 'Boutique', badge: true, amount: 123456, body: 'Total 123456 FCFA' } as never);
    expect(JSON.parse(transport.sent[0]!.body)).toEqual({ type: 'report_sent', businessName: 'Boutique', badge: true });
    expect(transport.sent[0]!.body).not.toContain('123456');
  });

  it('révoque aussitôt un abonnement expiré (404 / 410) et ne l\'utilise plus', async () => {
    const { transport, sender } = make();
    const a = await register('A', 1);
    transport.nextStatuses.push(410);
    await sender.sendToUser(a.user.id, { type: 'reminder' });
    expect((await rows(a.user.id))[0]!.revoked_at).not.toBeNull();
    await sender.sendToUser(a.user.id, { type: 'reminder' });
    expect(transport.sent).toHaveLength(1); // pas de second essai sur un abonnement révoqué
    const b = await register('B', 2);
    transport.nextStatuses.push(404);
    await sender.sendToUser(b.user.id, { type: 'reminder' });
    expect((await rows(b.user.id))[0]!.revoked_at).not.toBeNull();
  });

  it(`tolère les échecs transitoires, puis révoque après ${PUSH_MAX_FAILURES} échecs consécutifs ; un succès remet le compteur à zéro`, async () => {
    const { transport, sender } = make();
    const a = await register('A', 1);
    transport.nextStatuses.push(500, 500, 201);
    for (let i = 0; i < 3; i++) await sender.sendToUser(a.user.id, { type: 'reminder' });
    expect((await rows(a.user.id))[0]).toMatchObject({ failure_count: 0, revoked_at: null });
    for (let i = 0; i < PUSH_MAX_FAILURES - 1; i++) {
      transport.nextStatuses.push(503);
      await sender.sendToUser(a.user.id, { type: 'reminder' });
    }
    expect((await rows(a.user.id))[0]!.revoked_at).toBeNull();
    transport.nextStatuses.push(503);
    await sender.sendToUser(a.user.id, { type: 'reminder' });
    expect((await rows(a.user.id))[0]!.revoked_at).not.toBeNull();
  });

  it('ne lève jamais, même si le transport plante', async () => {
    const a = await register('A', 1);
    const boom = new DbPushSender(ctx.db, ctx.clock, { send: async () => { throw new Error('réseau coupé'); } });
    await expect(boom.sendToUser(a.user.id, { type: 'reminder' })).resolves.toBeUndefined();
    expect((await rows(a.user.id))[0]!.failure_count).toBe(1);
    await expect(boom.sendToUser('00000000-0000-0000-0000-000000000000', { type: 'reminder' })).resolves.toBeUndefined();
  });
});

describe('notifications déclenchées après commit', () => {
  it('annonce un paiement confirmé sans montant, une seule fois même si le webhook est rejoué', async () => {
    const t = await mkTeam(ctx);
    const pay = await payFor(ctx, t.owner, t.businessId);
    expect(await pay.send()).toBe('confirmed');
    const sent = ctx.providers.push.sent.filter((p) => p.payload.type === 'payment_confirmed');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.userId).toBe(t.owner.user.id);
    expect(JSON.stringify(sent[0]!.payload)).not.toMatch(/2000|FCFA/);
    // Rejeu du même webhook : doublon, aucune seconde notification.
    expect(await pay.send()).toBe('duplicate');
    expect(ctx.providers.push.sent.filter((p) => p.payload.type === 'payment_confirmed')).toHaveLength(1);
  });

  it('ne notifie pas le propriétaire quand la modification est refusée', async () => {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    const emp = await t.addMember('Awa', t.roles.entry);
    const r = await reports.submit(emp.user, t.businessId, reportInput(1000, { openingCash: 0 }));
    const before = ctx.providers.push.sent.length;
    ctx.clock.advance(25 * 3600_000);
    await expectCode(reports.edit(emp.user, r.id, { content: reportInput(500).content }), 'edit_window_closed');
    expect(ctx.providers.push.sent).toHaveLength(before);
  });
});

describe('rappels quotidiens et expiration proche', () => {
  const at = (iso: string) => ctx.clock.set(Date.parse(iso));
  const remindersSent = () => ctx.providers.push.sent.filter((p) => p.payload.type === 'reminder');
  const setReminder = (businessId: string, hhmm: string) => ctx.db.query('update businesses set reminder_time = $2 where id = $1', [businessId, hhmm]);

  it('envoie le rappel aux MANAGERS qui peuvent saisir (§6.7) : ni au propriétaire, ni au lecteur seul ; une fois par jour', async () => {
    const t = await mkTeam(ctx);
    const full = await t.addMember('Gérant', t.roles.full);
    const entry = await t.addMember('Caissière', t.roles.entry);
    const readonly = await t.addMember('Comptable', t.roles.readonly);
    await setReminder(t.businessId, '18:00');
    at('2026-10-19T17:30:00Z'); // 18:30 à Cotonou (UTC+1)
    const jobs = new ScheduledJobs(ctx.deps);
    expect((await jobs.runOnce({ reconcile: false })).reminders).toBe(2);
    expect(remindersSent().map((p) => p.userId).sort()).toEqual([full.user.id, entry.user.id].sort());
    expect(remindersSent().some((p) => p.userId === t.owner.user.id || p.userId === readonly.user.id)).toBe(false);
    expect(remindersSent().every((p) => p.payload.businessName === 'Boutique Étoile')).toBe(true);
    expect((await jobs.runOnce({ reconcile: false })).reminders).toBe(0); // dédupliqué
    expect(remindersSent()).toHaveLength(2);
    at('2026-10-20T17:30:00Z'); // lendemain : de nouveau
    expect((await jobs.runOnce({ reconcile: false })).reminders).toBe(2);
  });

  it('n\'envoie aucun rappel quand le business n\'a pas de manager', async () => {
    const t = await mkTeam(ctx);
    await setReminder(t.businessId, '18:00');
    at('2026-10-19T17:30:00Z');
    expect((await new ScheduledJobs(ctx.deps).runOnce({ reconcile: false })).reminders).toBe(0);
    expect(remindersSent()).toHaveLength(0);
  });

  it('respecte la fenêtre horaire et le fuseau du pays du business', async () => {
    const bj = await mkTeam(ctx, { country: 'BJ' });
    const ci = await mkTeam(ctx, { country: 'CI' });
    const bjMgr = await bj.addMember('Manager BJ', bj.roles.entry);
    const ciMgr = await ci.addMember('Manager CI', ci.roles.entry);
    await setReminder(bj.businessId, '18:00');
    await setReminder(ci.businessId, '18:00');
    const jobs = new ScheduledJobs(ctx.deps);
    at('2026-10-19T16:59:00Z'); // 17:59 BJ, 16:59 CI : trop tôt pour les deux
    expect((await jobs.runOnce({ reconcile: false })).reminders).toBe(0);
    at('2026-10-19T17:05:00Z'); // 18:05 BJ (envoi), 17:05 CI (pas encore)
    await jobs.runOnce({ reconcile: false });
    expect(remindersSent().map((p) => p.userId)).toEqual([bjMgr.user.id]);
    at('2026-10-19T18:30:00Z'); // 19:30 BJ (déjà envoyé), 18:30 CI (maintenant)
    await jobs.runOnce({ reconcile: false });
    expect(remindersSent().map((p) => p.userId).sort()).toEqual([bjMgr.user.id, ciMgr.user.id].sort());
    // Hors fenêtre (3 h après) : un redémarrage tardif n'envoie pas de rappel périmé.
    const late = await mkTeam(ctx, { country: 'BJ' });
    const lateMgr = await late.addMember('Manager tardif', late.roles.entry);
    await setReminder(late.businessId, '08:00');
    at('2026-10-19T20:00:00Z');
    await jobs.runOnce({ reconcile: false });
    expect(remindersSent().some((p) => p.userId === lateMgr.user.id)).toBe(false);
  });

  it('ne rappelle pas si un bilan existe déjà aujourd\'hui, ni si l\'abonnement est bloqué', async () => {
    const { reports } = services(ctx);
    const done = await mkTeam(ctx);
    const quiet = await mkTeam(ctx);
    const doneMgr = await done.addMember('Manager A', done.roles.entry);
    const quietMgr = await quiet.addMember('Manager B', quiet.roles.entry);
    await setReminder(done.businessId, '18:00');
    await setReminder(quiet.businessId, '18:00');
    at('2026-10-19T16:00:00Z');
    await reports.submit(done.owner.user, done.businessId, reportInput(1000, { openingCash: 0 }));
    at('2026-10-19T17:30:00Z');
    await new ScheduledJobs(ctx.deps).runOnce({ reconcile: false });
    expect(remindersSent().map((p) => p.userId)).toEqual([quietMgr.user.id]);
    expect(remindersSent().some((p) => p.userId === doneMgr.user.id)).toBe(false);
    // Abonnement bloqué : plus de saisie possible, donc plus de rappel.
    ctx.providers.push.sent.length = 0;
    at('2026-10-31T17:30:00Z');
    await new ScheduledJobs(ctx.deps).runOnce({ reconcile: false });
    expect(remindersSent()).toHaveLength(0);
  });

  it('prévient le propriétaire chaque jour de J-3 à J-1 avant la fin, une fois par jour, sans montant', async () => {
    const t = await mkTeam(ctx);
    await t.addMember('Caissière', t.roles.entry);
    const jobs = new ScheduledJobs(ctx.deps);
    const expiring = () => ctx.providers.push.sent.filter((p) => p.payload.type === 'expiring');
    ctx.clock.set(T0 + 3 * DAY_MS); // 4 jours restants : trop tôt
    expect((await jobs.runOnce({ reconcile: false })).expiring).toBe(0);
    ctx.clock.set(T0 + 4 * DAY_MS + 1000); // 3 jours restants
    expect((await jobs.runOnce({ reconcile: false })).expiring).toBe(1);
    expect((await jobs.runOnce({ reconcile: false })).expiring).toBe(0); // déjà envoyé aujourd'hui
    ctx.clock.advance(DAY_MS);
    expect((await jobs.runOnce({ reconcile: false })).expiring).toBe(1);
    expect(expiring().every((p) => p.userId === t.owner.user.id)).toBe(true); // jamais à un employé
    expect(JSON.stringify(expiring().map((p) => p.payload))).not.toMatch(/\d{4}/);
    ctx.clock.set(T0 + 8 * DAY_MS); // période de grâce : l'avis d'expiration proche ne s'applique plus
    expect((await jobs.runOnce({ reconcile: false })).expiring).toBe(0);
  });

  it('exécute le rapprochement FedaPay puis les notifications, et isole les pannes', async () => {
    const t = await mkTeam(ctx);
    await t.addMember('Caissière', t.roles.entry); // destinataire du rappel (le propriétaire n'en reçoit pas)
    const { subs } = services(ctx);
    const checkout = await subs.createCheckout(t.owner.user, t.businessId);
    const created = ctx.providers.gateway.created.find((c) => c.merchantReference === checkout.merchantReference)!;
    ctx.providers.gateway.states.set(created.transactionId, { transactionId: created.transactionId, merchantReference: checkout.merchantReference, status: 'approved', amount: 2000, provider: 'MTN' });
    ctx.clock.advance(10 * 60_000); // plus de 5 minutes : éligible au rapprochement
    const jobs = new ScheduledJobs(ctx.deps);
    const out = await jobs.runOnce();
    expect(out.reconcile).toEqual({ checked: 1, confirmed: 1 });
    expect((await subs.view(t.owner.user, t.businessId)).status).toBe('active');
    expect((await jobs.runOnce()).reconcile).toEqual({ checked: 0, confirmed: 0 }); // idempotent

    // Panne du fournisseur push : l'erreur est signalée, les autres tâches continuent.
    const broken = new ScheduledJobs({ ...ctx.deps, providers: { ...ctx.deps.providers, push: { sendToUser: async () => { throw new Error('boom'); } } } });
    await setReminder(t.businessId, '10:30');
    ctx.clock.set(Date.parse('2026-10-20T10:00:00Z')); // 11:00 BJ, dans la fenêtre
    const res = await broken.runOnce({ reconcile: true });
    expect(res.errors.some((e) => e.startsWith('reminders'))).toBe(true);
    expect(res.reconcile).not.toBeNull();
  });
});

describe('ordonnanceur', () => {
  it('exécute les tâches périodiquement, sans chevauchement, et ne rapproche pas à chaque cycle', async () => {
    const summaries: JobSummary[] = [];
    const stop = startScheduler(ctx.deps, { tickMs: 15, reconcileEveryMs: 3_600_000, onSummary: (s) => summaries.push(s) });
    const deadline = Date.now() + 3000;
    while (summaries.length < 3 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    stop();
    expect(summaries.length).toBeGreaterThanOrEqual(3);
    expect(summaries[0]!.reconcile).not.toBeNull(); // premier cycle : rapprochement
    expect(summaries.slice(1).every((s) => s.reconcile === null)).toBe(true); // puis une fois par heure seulement
  });
});

describe('routes HTTP Web Push', () => {
  let app: FastifyInstance;
  const H = { 'x-gobilan-csrf': '1', origin: 'http://localhost:5173', 'content-type': 'application/json' };
  const device = { deviceId: 'device-push-0001', label: 'test' };

  const signup = async (phone: string) => {
    await app.inject({ method: 'POST', url: '/v1/auth/otp/request', headers: H, payload: { country: 'BJ', phone, purpose: 'signup', device, captchaToken: 'ok' } });
    const code = ctx.providers.messages.whatsapp.at(-1)!.code;
    const verified = await app.inject({ method: 'POST', url: '/v1/auth/otp/verify', headers: H, payload: { country: 'BJ', phone, purpose: 'signup', code, device } });
    const created = await app.inject({ method: 'POST', url: '/v1/auth/pin/create', headers: H, payload: { otpProof: (verified.json() as { proof: string }).proof, pin: '4827', device } });
    return created.cookies.find((c) => c.name === 'gb_user')!.value;
  };

  beforeEach(async () => {
    app = buildApp(ctx.deps, { secureCookies: true, rateLimit: false });
    await app.ready();
  });

  it('exige une session et l\'en-tête CSRF', async () => {
    expect((await app.inject({ method: 'POST', url: '/v1/push/subscriptions', headers: H, payload: sub(1) })).statusCode).toBe(401);
    const cookie = await signup('0102030405');
    expect((await app.inject({ method: 'POST', url: '/v1/push/subscriptions', headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' }, cookies: { gb_user: cookie }, payload: sub(1) })).statusCode).toBe(403);
  });

  it('enregistre un abonnement valide, refuse HTTP clair et les corps invalides', async () => {
    const cookie = await signup('0102030405');
    const ok = await app.inject({ method: 'POST', url: '/v1/push/subscriptions', headers: H, cookies: { gb_user: cookie }, payload: sub(1) });
    expect(ok.statusCode).toBe(200);
    expect((await ctx.db.query('select 1 from push_subscriptions where revoked_at is null')).rows).toHaveLength(1);
    const insecure = await app.inject({ method: 'POST', url: '/v1/push/subscriptions', headers: H, cookies: { gb_user: cookie }, payload: { endpoint: 'http://push.example.test/x', keys: KEYS } });
    expect(insecure.statusCode).toBe(400);
    const empty = await app.inject({ method: 'POST', url: '/v1/push/subscriptions', headers: H, cookies: { gb_user: cookie }, payload: { endpoint: sub(2).endpoint } });
    expect(empty.statusCode).toBe(400);
    const off = await app.inject({ method: 'POST', url: '/v1/push/unsubscribe', headers: H, cookies: { gb_user: cookie }, payload: { endpoint: sub(1).endpoint } });
    expect(off.statusCode).toBe(200);
    expect((await ctx.db.query('select 1 from push_subscriptions where revoked_at is null')).rows).toHaveLength(0);
  });

  it('n\'annonce la clé publique VAPID que si elle est configurée, et jamais de clé privée', async () => {
    const cookie = await signup('0102030405');
    const off = await app.inject({ method: 'GET', url: '/v1/push/config', cookies: { gb_user: cookie } });
    expect(off.json()).toEqual({ enabled: false, publicKey: null });
    const withKey = buildApp({ ...ctx.deps, config: { ...ctx.deps.config, vapidPublicKey: 'BPublicVapidKeyForTests' } }, { secureCookies: true, rateLimit: false });
    const on = await withKey.inject({ method: 'GET', url: '/v1/push/config', cookies: { gb_user: cookie } });
    expect(on.json()).toEqual({ enabled: true, publicKey: 'BPublicVapidKeyForTests' });
  });
});
