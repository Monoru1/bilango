import { beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS, expectCode, makeDeps, mkTeam, mkUser, payFor, reportInput, sendWebhook, services, type Ctx } from './helpers';

let ctx: Ctx;
beforeEach(async () => {
  ctx = await makeDeps();
});

const paidUntil = async (id: string) => (await ctx.db.query<{ p: Date | null }>('select paid_until p from businesses where id = $1', [id])).rows[0]!.p;

describe('essai et statuts (§8.1, §8.3)', () => {
  it('accorde 7 jours d\'essai puis 3 jours de grâce puis bloque', async () => {
    const { subs } = services(ctx);
    const t = await mkTeam(ctx);
    expect(await subs.view(t.owner.user, t.businessId)).toMatchObject({ status: 'trial', daysRemaining: 7 });
    ctx.clock.advance(7 * DAY_MS);
    expect((await subs.view(t.owner.user, t.businessId)).status).toBe('grace');
    ctx.clock.advance(3 * DAY_MS);
    expect((await subs.view(t.owner.user, t.businessId)).status).toBe('blocked');
  });

  it("n'accorde l'essai qu'UNE fois par numéro : un 2e business démarre sans essai (D-014)", async () => {
    const { biz, subs } = services(ctx);
    const t = await mkTeam(ctx);
    const second = await biz.createBusiness(t.owner.user, t.owner.deviceRowId, { name: 'Second', country: 'BJ', sector: 'other', stockEnabled: false });
    expect(second.trialGranted).toBe(false);
    expect((await subs.view(t.owner.user, second.id)).status).toBe('blocked');
  });

  it("n'accorde pas un 2e essai à un autre numéro sur le MÊME appareil", async () => {
    const { biz } = services(ctx);
    const a = await mkUser(ctx, 'A');
    const first = await biz.createBusiness(a.user, a.deviceRowId, { name: 'A1', country: 'BJ', sector: 'other', stockEnabled: false });
    expect(first.trialGranted).toBe(true);
    const b = await mkUser(ctx, 'B');
    await ctx.db.query('update devices set device_key = (select device_key from devices where id = $1) where id = $2', [a.deviceRowId, b.deviceRowId]);
    expect((await biz.createBusiness(b.user, b.deviceRowId, { name: 'B1', country: 'BJ', sector: 'other', stockEnabled: false })).trialGranted).toBe(false);
  });

  it('affiche les pop-ups J-3 et de grâce au propriétaire', async () => {
    const { subs } = services(ctx);
    const t = await mkTeam(ctx);
    ctx.clock.advance(4 * DAY_MS + 1000);
    expect((await subs.view(t.owner.user, t.businessId)).popup).toMatchObject({ kind: 'expiring', message: 'Votre abonnement se termine dans 3 jours.' });
    ctx.clock.advance(3 * DAY_MS);
    expect((await subs.view(t.owner.user, t.businessId)).popup).toMatchObject({ kind: 'grace', message: 'Votre abonnement a expiré.' });
    ctx.clock.advance(3 * DAY_MS);
    expect((await subs.view(t.owner.user, t.businessId)).popup).toMatchObject({ kind: 'blocked', dismissible: false });
  });
});

describe('blocage dès le 4e jour (§8.3 bis, §8.4)', () => {
  it('coupe la saisie avec un message NEUTRE pour l\'employé, garde les données, et rouvre au paiement', async () => {
    const { reports, subs } = services(ctx);
    const t = await mkTeam(ctx);
    const emp = await t.addMember('Awa', t.roles.entry);
    const before = await reports.submit(emp.user, t.businessId, reportInput(1000, { openingCash: 0 }));
    ctx.clock.advance(10 * DAY_MS);
    const err = await expectCode(reports.submit(emp.user, t.businessId, reportInput(500)), 'subscription_blocked');
    expect(err.message).toContain('Saisie momentanément indisponible');
    expect(err.message.toLowerCase()).not.toMatch(/abonnement|impay|paiement|renouvel/);
    await expectCode(reports.dashboard(t.owner.user, t.businessId), 'subscription_blocked');
    // Les données restent consultables en base, figées.
    expect(Number((await ctx.db.query<{ n: string }>('select count(*) n from reports where id = $1', [before.id])).rows[0]!.n)).toBe(1);

    const pay = await payFor(ctx, t.owner, t.businessId);
    expect(await pay.send()).toBe('confirmed');
    expect((await subs.view(t.owner.user, t.businessId)).status).toBe('active');
    const resumed = await reports.submit(emp.user, t.businessId, reportInput(500));
    // Pas de rattrapage : le bilan est daté d'AUJOURD'HUI, les jours bloqués restent vides.
    expect(resumed.day).toBe('2026-10-29');
    const days = (await ctx.db.query<{ day: string }>('select day from reports order by day')).rows.map((r) => r.day);
    expect(days).toEqual(['2026-10-19', '2026-10-29']);
  });

  it("bloque aussi la modification d'un bilan existant", async () => {
    const { reports } = services(ctx);
    const t = await mkTeam(ctx);
    const emp = await t.addMember('Awa', t.roles.entry);
    const r = await reports.submit(emp.user, t.businessId, reportInput(1000, { openingCash: 0 }));
    ctx.clock.advance(10 * DAY_MS);
    await expectCode(reports.edit(emp.user, r.id, { content: reportInput(1).content }), 'subscription_blocked');
  });
});

describe('webhook FedaPay (§8.2)', () => {
  it("n'étend JAMAIS l'abonnement à la création du paiement ni sur simple redirection", async () => {
    const t = await mkTeam(ctx);
    const before = await paidUntil(t.businessId);
    await payFor(ctx, t.owner, t.businessId); // checkout créé, webhook NON envoyé
    expect(await paidUntil(t.businessId)).toEqual(before);
  });

  it('prolonge de 30 jours en ajoutant les jours d\'essai restants', async () => {
    const t = await mkTeam(ctx);
    ctx.clock.advance(2 * DAY_MS); // 5 jours d'essai restants
    expect(await (await payFor(ctx, t.owner, t.businessId)).send()).toBe('confirmed');
    expect((await paidUntil(t.businessId))!.getTime()).toBe(Date.parse('2026-10-19T10:00:00.000Z') + (7 + 30) * DAY_MS);
  });

  it("repart de la date du paiement quand l'abonnement a expiré, y compris pendant la grâce", async () => {
    const t = await mkTeam(ctx);
    ctx.clock.advance(8 * DAY_MS);
    const now = ctx.clock.now();
    await (await payFor(ctx, t.owner, t.businessId)).send();
    expect((await paidUntil(t.businessId))!.getTime()).toBe(now + 30 * DAY_MS);
  });

  it('rejette une signature absente, fausse, falsifiée ou périmée', async () => {
    const t = await mkTeam(ctx);
    const p = await payFor(ctx, t.owner, t.businessId);
    const { subs } = services(ctx);
    const raw = JSON.stringify(p.event);
    await expectCode(subs.handleWebhook(raw, undefined), 'unauthenticated');
    await expectCode(subs.handleWebhook(raw, 't=1,s=deadbeef'), 'unauthenticated');
    await expectCode(sendWebhook(ctx, p.event, { secret: 'autre-secret' }), 'unauthenticated');
    // Corps modifié après signature.
    const { signFedapayWebhook } = await import('../src/crypto');
    const header = signFedapayWebhook(raw, ctx.deps.secrets.fedapayWebhookSecret, Math.floor(ctx.clock.now() / 1000));
    await expectCode(subs.handleWebhook(raw.replace('2000', '1'), header), 'unauthenticated');
    // Horodatage hors tolérance (rejeu d'un vieil évènement) — dans les deux sens.
    await expectCode(sendWebhook(ctx, p.event, { timestampSec: Math.floor(ctx.clock.now() / 1000) - 301 }), 'unauthenticated');
    await expectCode(sendWebhook(ctx, p.event, { timestampSec: Math.floor(ctx.clock.now() / 1000) + 301 }), 'unauthenticated');
    expect(await paidUntil(t.businessId)).not.toBeNull; // aucune prolongation obtenue
    expect((await ctx.db.query('select 1 from payments where status = \'confirmed\'')).rows).toHaveLength(0);
  });

  it('est idempotent : rejouer le même évènement, ou un second évènement du même paiement, ne prolonge qu\'une fois', async () => {
    const t = await mkTeam(ctx);
    const p = await payFor(ctx, t.owner, t.businessId, { eventId: 'evt_A' });
    expect(await p.send()).toBe('confirmed');
    const once = await paidUntil(t.businessId);
    expect(await p.send()).toBe('duplicate');
    expect(await sendWebhook(ctx, { ...p.event, id: 'evt_B' })).toBe('duplicate');
    expect(await paidUntil(t.businessId)).toEqual(once);
    const confirmed = (await ctx.db.query<{ n: string }>(`select count(*) n from payments where status = 'confirmed'`)).rows[0]!.n;
    expect(Number(confirmed)).toBe(1);
  });

  it('deux webhooks simultanés du même paiement ne prolongent qu\'une fois', async () => {
    const t = await mkTeam(ctx);
    const p = await payFor(ctx, t.owner, t.businessId);
    const res = await Promise.all([sendWebhook(ctx, { ...p.event, id: 'evt_1' }), sendWebhook(ctx, { ...p.event, id: 'evt_2' })]);
    expect(res.filter((r) => r === 'confirmed')).toHaveLength(1);
    expect((await paidUntil(t.businessId))!.getTime()).toBe(Date.parse('2026-10-19T10:00:00.000Z') + 37 * DAY_MS);
  });

  it("ne perd pas le paiement si la vérification passerelle échoue : FedaPay peut rejouer l'évènement", async () => {
    const t = await mkTeam(ctx);
    const p = await payFor(ctx, t.owner, t.businessId, { eventId: 'evt_retry' });
    const saved = ctx.providers.gateway.states.get(p.created.transactionId)!;
    ctx.providers.gateway.states.delete(p.created.transactionId); // passerelle injoignable / transaction introuvable
    await expectCode(p.send(), 'internal');
    expect((await ctx.db.query('select 1 from payments where status = \'confirmed\'')).rows).toHaveLength(0);
    ctx.providers.gateway.states.set(p.created.transactionId, saved);
    expect(await p.send()).toBe('confirmed');
  });

  it('refuse un montant différent de celui créé par le serveur, un autre business, ou le mauvais mode', async () => {
    const t = await mkTeam(ctx);
    const other = await mkTeam(ctx);
    // Montant : la passerelle dit 1 FCFA.
    let p = await payFor(ctx, t.owner, t.businessId);
    ctx.providers.gateway.states.get(p.created.transactionId)!.amount = 1;
    expect(await p.send()).toBe('ignored');
    // Business : metadata d'un autre business.
    p = await payFor(ctx, t.owner, t.businessId);
    expect(await sendWebhook(ctx, { ...p.event, entity: { ...p.event.entity, custom_metadata: { business_id: other.businessId } } })).toBe('ignored');
    // Mode : un évènement `live` en environnement sandbox.
    p = await payFor(ctx, t.owner, t.businessId, { mode: 'live' });
    expect(await p.send()).toBe('ignored');
    // Transaction « approuvée » dans la charge utile mais en attente côté passerelle.
    p = await payFor(ctx, t.owner, t.businessId);
    ctx.providers.gateway.states.get(p.created.transactionId)!.status = 'pending';
    expect(await p.send()).toBe('ignored');
    expect((await ctx.db.query('select 1 from payments where status = \'confirmed\'')).rows).toHaveLength(0);
  });

  it('ignore une référence inconnue', async () => {
    expect(await sendWebhook(ctx, { id: 'evt_x', name: 'transaction.approved', entity: { id: '1', status: 'approved', merchant_reference: 'SUB-inconnu', mode: 'test' } })).toBe('ignored');
  });

  it('une transaction refusée ou annulée ne prolonge rien', async () => {
    const t = await mkTeam(ctx);
    const p = await payFor(ctx, t.owner, t.businessId);
    expect(await sendWebhook(ctx, { ...p.event, id: 'evt_d', name: 'transaction.declined' })).toBe('failed');
    expect((await ctx.db.query<{ status: string }>('select status from payments')).rows[0]!.status).toBe('failed');
    expect(await paidUntil(t.businessId)).toBeNull();
  });

  it("la vérification périodique de secours confirme un paiement dont le webhook n'est jamais arrivé", async () => {
    const t = await mkTeam(ctx);
    const p = await payFor(ctx, t.owner, t.businessId); // approuvé côté passerelle, webhook perdu
    ctx.clock.advance(10 * 60_000);
    const { subs } = services(ctx);
    expect(await subs.reconcilePending()).toEqual({ checked: 1, confirmed: 1 });
    expect(await subs.reconcilePending()).toEqual({ checked: 0, confirmed: 0 });
    expect(p.checkout.paymentUrl).toContain('sandbox.invalid');
  });

  it('chaque transaction a un merchant_reference unique rattaché au business', async () => {
    const t = await mkTeam(ctx);
    const a = await payFor(ctx, t.owner, t.businessId);
    const b = await payFor(ctx, t.owner, t.businessId);
    expect(a.checkout.merchantReference).not.toBe(b.checkout.merchantReference);
    expect(a.checkout.merchantReference).toContain(t.businessId);
    expect(ctx.providers.gateway.created[0]!.metadata).toEqual({ business_id: t.businessId, type: 'renouvellement_abonnement' });
    expect(ctx.providers.gateway.created[0]!.amount).toBe(2000);
  });
});
