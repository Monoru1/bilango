import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/http/app';
import { AuthService } from '../src/services/auth';
import { OwnerReferralService } from '../src/services/owner-referrals';
import { expectCode, makeDeps, mkPartner, mkTeam, mkUser, partnerServices, payFor, services, type Ctx } from './helpers';

// SEC-48 — désactivation auditée des codes de parrainage propriétaire.
const AH = { 'x-gobilan-csrf': '1', origin: 'http://localhost:5175', 'content-type': 'application/json' };
const PH = { 'x-gobilan-csrf': '1', origin: 'http://localhost:5174', 'content-type': 'application/json' };
const URL = '/v1/admin/owner-referral-codes/deactivate';
const cookieOf = (res: { cookies: { name: string; value: string }[] }, name: string) => res.cookies.find((c) => c.name === name)?.value;

let ctx: Ctx;
let app: FastifyInstance;
let adminCookie: string;
let code: string;
let sponsor: Awaited<ReturnType<typeof mkTeam>>;

async function adminLogin(email: string) {
  const { admin } = partnerServices(ctx);
  await admin.upsertAdmin(email, 'admin-mot-de-passe-long');
  const s1 = await app.inject({ method: 'POST', url: '/v1/admin/login', headers: AH, payload: { email, password: 'admin-mot-de-passe-long' } });
  const otp = /\b(\d{6})\b/.exec(ctx.providers.messages.emails.at(-1)!.text)![1]!;
  const s2 = await app.inject({ method: 'POST', url: '/v1/admin/login/verify', headers: AH, payload: { challengeId: (s1.json() as { challengeId: string }).challengeId, code: otp } });
  expect(s2.statusCode).toBe(200);
  return cookieOf(s2, 'gb_admin')!;
}
const deactivate = (payload: unknown, cookies: Record<string, string> = { gb_admin: adminCookie }, headers: Record<string, string> = AH) =>
  app.inject({ method: 'POST', url: URL, headers, cookies, payload: payload as object });

beforeEach(async () => {
  ctx = await makeDeps();
  app = buildApp(ctx.deps, { secureCookies: true, rateLimit: false });
  await app.ready();
  adminCookie = await adminLogin('admin@novadis.test');
  sponsor = await mkTeam(ctx);
  expect(await (await payFor(ctx, sponsor.owner, sponsor.businessId)).send()).toBe('confirmed');
  code = (await new OwnerReferralService(ctx.deps).generate(sponsor.owner.user)).code;
});

describe('SEC-48 — désactivation d’un code de parrainage propriétaire', () => {
  it('exige une session administrateur, l’origine admin et la protection CSRF', async () => {
    const body = { code, reason: 'Abus signalé' };
    expect((await deactivate(body, {})).statusCode).toBe(401);
    await mkPartner(ctx, { role: 'manager' }, 'm@ex.test');
    const partner = await app.inject({ method: 'POST', url: '/v1/partner/login', headers: PH, payload: { email: 'm@ex.test', password: 'motdepasse-solide' } });
    expect((await deactivate(body, { gb_admin: cookieOf(partner, 'gb_partner')! })).statusCode).toBe(401);
    expect((await deactivate(body, { gb_admin: adminCookie }, PH)).statusCode).toBe(403);
    expect((await deactivate(body, { gb_admin: adminCookie }, { origin: AH.origin, 'content-type': 'application/json' })).statusCode).toBe(403);
    // Une session propriétaire n'ouvre pas la route admin.
    expect((await app.inject({ method: 'POST', url: URL, headers: { ...AH, origin: 'http://localhost:5173' }, payload: body })).statusCode).toBeGreaterThanOrEqual(401);
    expect((await ctx.db.query<{ active: boolean }>('select active from owner_referral_codes where code=$1', [code])).rows[0]!.active).toBe(true);
    expect((await ctx.db.query("select 1 from audit_log where action='owner_referral_code.deactivate'")).rows).toHaveLength(0);
  });

  it('exige un motif et un code valide', async () => {
    for (const bad of [{ code }, { code, reason: '' }, { code, reason: '  a ' }, { code: 'abc', reason: 'Motif valable' }, { reason: 'Motif valable' }]) {
      expect((await deactivate(bad)).statusCode).toBe(400);
    }
    expect((await deactivate({ code: 'ZZZZZZZZ', reason: 'Motif valable' })).statusCode).toBe(404);
    expect((await ctx.db.query<{ active: boolean }>('select active from owner_referral_codes where code=$1', [code])).rows[0]!.active).toBe(true);
  });

  it('désactive, journalise auteur, date et motif, et reflète l’état dans la liste et chez le propriétaire', async () => {
    const res = await deactivate({ code, reason: '  Abus signalé par le support  ' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ code, active: false });
    const audit = (await ctx.db.query<{ at: Date; actor: string; target: string; old_value: unknown; new_value: unknown }>(
      "select at, actor, target, old_value, new_value from audit_log where action='owner_referral_code.deactivate'")).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor: 'admin@novadis.test', target: code, old_value: { active: true }, new_value: { active: false, reason: 'Abus signalé par le support' } });
    expect(audit[0]!.at.getTime()).toBe(ctx.clock.now());
    const list = await app.inject({ method: 'GET', url: `/v1/admin/owner-referral-codes?limit=50&offset=0&q=${code}`, cookies: { gb_admin: adminCookie } });
    expect((list.json() as { codes: { code: string; active: boolean }[] }).codes).toEqual([expect.objectContaining({ code, active: false })]);
    // Le propriétaire garde le même code, inactif : aucun nouveau code n'est émis ni réattribué.
    expect(await new OwnerReferralService(ctx.deps).generate(sponsor.owner.user)).toEqual({ code, active: false });
    expect((await ctx.db.query('select 1 from owner_referral_codes')).rows).toHaveLength(1);
  });

  it('traite explicitement une désactivation répétée, sans seconde ligne d’audit', async () => {
    expect((await deactivate({ code, reason: 'Premier motif' })).statusCode).toBe(200);
    const again = await deactivate({ code, reason: 'Second motif' });
    expect(again.statusCode).toBe(409);
    expect((again.json() as { error: { code: string } }).error.code).toBe('conflict');
    expect((await ctx.db.query("select 1 from audit_log where action='owner_referral_code.deactivate'")).rows).toHaveLength(1);
  });

  it('conserve les attributions passées et leur crédit, et refuse toute nouvelle attribution', async () => {
    const auth = new AuthService(ctx.deps);
    const before = await mkUser(ctx, 'Filleul avant');
    await auth.updateProfile(before.user.id, 'Filleul avant', code);
    expect((await deactivate({ code, reason: 'Abus signalé' })).statusCode).toBe(200);

    const after = await mkUser(ctx, 'Filleul après');
    await expectCode(auth.updateProfile(after.user.id, 'Filleul après', code), 'validation');
    const attributions = await ctx.db.query<{ referred_user_id: string }>('select referred_user_id from owner_referral_attributions');
    expect(attributions.rows).toEqual([{ referred_user_id: before.user.id }]);

    // Le filleul attribué avant la désactivation déclenche toujours le crédit au premier paiement confirmé.
    const business = await services(ctx).biz.createBusiness(before.user, before.deviceRowId, { name: 'Test', country: 'BJ', sector: 'boutique', stockEnabled: false });
    expect(await (await payFor(ctx, before, business.id)).send()).toBe('confirmed');
    expect((await ctx.db.query<{ referred_user_id: string; days: number }>('select referred_user_id,days from owner_referral_rewards')).rows).toEqual([{ referred_user_id: before.user.id, days: 30 }]);
    expect(await new OwnerReferralService(ctx.deps).view(sponsor.owner.user)).toMatchObject({ code: { code, active: false }, registrations: 1, paid: 1, days: 30 });
  });

  it('reste cohérent sous accès simultanés : une seule désactivation, aucune attribution après elle', async () => {
    const second = await adminLogin('second@novadis.test');
    const auth = new AuthService(ctx.deps);
    const users = await Promise.all(['A', 'B', 'C', 'D'].map((n) => mkUser(ctx, `Filleul ${n}`)));
    const [admins, attempts] = await Promise.all([
      Promise.all([deactivate({ code, reason: 'Motif un' }), deactivate({ code, reason: 'Motif deux' }, { gb_admin: second })]),
      Promise.allSettled(users.map((u) => auth.updateProfile(u.user.id, 'Filleul', code))),
    ]);
    expect(admins.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const audit = await ctx.db.query<{ at: Date }>("select at from audit_log where action='owner_referral_code.deactivate'");
    expect(audit.rows).toHaveLength(1);
    expect((await ctx.db.query<{ active: boolean }>('select active from owner_referral_codes where code=$1', [code])).rows[0]!.active).toBe(false);
    // Chaque attribution a soit entièrement réussi avant la désactivation, soit été refusée : jamais de doublon.
    const attributed = await ctx.db.query<{ referred_user_id: string }>('select referred_user_id from owner_referral_attributions');
    expect(new Set(attributed.rows.map((r) => r.referred_user_id)).size).toBe(attributed.rows.length);
    const accepted = attempts.filter((r) => r.status === 'fulfilled').length;
    expect(attributed.rows).toHaveLength(accepted);
    const late = await mkUser(ctx, 'Tardif');
    await expectCode(auth.updateProfile(late.user.id, 'Tardif', code), 'validation');
  });
});
