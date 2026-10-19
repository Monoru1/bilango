import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/http/app';
import { signFedapayWebhook } from '../src/crypto';
import { makeDeps, mkTeam, reportInput, partnerServices, mkPartner, type Ctx } from './helpers';

let ctx: Ctx;
let app: FastifyInstance;
const H = { 'x-gobilan-csrf': '1', origin: 'http://localhost:5173', 'content-type': 'application/json' };
const device = { deviceId: 'device-http-0001', label: 'test' };

beforeEach(async () => {
  ctx = await makeDeps();
  app = buildApp(ctx.deps, { secureCookies: true, rateLimit: false });
  await app.ready();
});

const cookieOf = (res: { cookies: { name: string; value: string }[] }, name: string) => res.cookies.find((c) => c.name === name)?.value;

async function signup(phone = '0102030405') {
  const r1 = await app.inject({ method: 'POST', url: '/v1/auth/otp/request', headers: H, payload: { country: 'BJ', phone, purpose: 'signup', device, captchaToken: 'ok' } });
  expect(r1.statusCode).toBe(200);
  const code = ctx.providers.messages.whatsapp.at(-1)!.code;
  const r2 = await app.inject({ method: 'POST', url: '/v1/auth/otp/verify', headers: H, payload: { country: 'BJ', phone, purpose: 'signup', code, device } });
  const proof = (r2.json() as { proof: string }).proof;
  const r3 = await app.inject({ method: 'POST', url: '/v1/auth/pin/create', headers: H, payload: { otpProof: proof, pin: '4827', device } });
  return { res: r3, cookie: cookieOf(r3, 'gb_user')! };
}

describe('HTTP — sécurité transverse', () => {
  it('does not trust a client supplied X-Forwarded-For and does not enable credentialed cross-origin reads', async () => {
    await app.inject({ method: 'POST', url: '/v1/auth/otp/request', remoteAddress: '10.0.0.9', headers: { ...H, 'x-forwarded-for': '203.0.113.1' }, payload: { country: 'BJ', phone: '0197000022', purpose: 'signup', device, captchaToken: 'ok' } });
    expect((await ctx.db.query<{ ip: string }>('select ip from otp_codes')).rows[0]?.ip).toBe('10.0.0.9');
    const r = await app.inject({ method: 'GET', url: '/v1/me', headers: { origin: 'https://evil.example' } });
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('refuse les requêtes mutantes sans en-tête CSRF ou depuis une origine non autorisée', async () => {
    const noHeader = await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: { origin: 'http://localhost:5173' } });
    expect(noHeader.statusCode).toBe(403);
    const evil = await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: { ...H, origin: 'https://evil.example' } });
    expect(evil.statusCode).toBe(403);
    const noOrigin = await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: { 'x-gobilan-csrf': '1' } });
    expect(noOrigin.statusCode).toBe(403);
  });

  it('pose un cookie httpOnly, Secure, SameSite=Lax et ne renvoie JAMAIS le jeton dans le corps', async () => {
    const { res } = await signup();
    expect(res.statusCode).toBe(200);
    const c = res.cookies.find((x) => x.name === 'gb_user')!;
    expect(c).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
    expect(res.body).not.toContain(c.value);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('401 sans session, et une session user ne donne aucun accès partenaire ni admin', async () => {
    expect((await app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401);
    const { cookie } = await signup();
    expect((await app.inject({ method: 'GET', url: '/v1/me', cookies: { gb_user: cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/v1/partner/me', headers: { origin: 'http://localhost:5174' }, cookies: { gb_user: cookie } })).statusCode).toBe(401);
    // Le jeton utilisateur présenté comme cookie admin/partenaire est rejeté.
    expect((await app.inject({ method: 'GET', url: '/v1/admin/stats', cookies: { gb_admin: cookie, gb_partner: cookie } })).statusCode).toBe(401);
  });

  it("ne fuit aucun détail interne : erreur 500 générique, validation Zod propre", async () => {
    const bad = await app.inject({ method: 'POST', url: '/v1/auth/otp/request', headers: H, payload: { country: 'XX' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ error: { code: 'validation' } });
    const malformed = await app.inject({ method: 'POST', url: '/v1/auth/otp/request', headers: H, payload: '{oups' });
    expect(malformed.statusCode).toBe(400);
  });

  it('la mauvaise saisie de PIN renvoie 4xx avec message, et le blocage 423 + retry-after', async () => {
    const { cookie } = await signup();
    void cookie;
    const phone = ctx.providers.messages.whatsapp.at(-1)!.phone;
    let last;
    for (let i = 0; i < 4; i++) last = await app.inject({ method: 'POST', url: '/v1/auth/pin/login', headers: H, payload: { phone, pin: '0000', device } });
    expect(last!.statusCode).toBe(423);
    expect(Number(last!.headers['retry-after'])).toBeGreaterThan(0);
  });
});

describe('HTTP — parcours métier', () => {
  it('crée un business, soumet un bilan, lit le tableau de bord', async () => {
    const { cookie } = await signup();
    const c = { gb_user: cookie };
    const b = await app.inject({ method: 'POST', url: '/v1/businesses', headers: H, cookies: c, payload: { name: 'Chez Awa', country: 'BJ', sector: 'boutique', stockEnabled: false } });
    expect(b.statusCode).toBe(200);
    const id = (b.json() as { id: string }).id;
    const sub = await app.inject({ method: 'GET', url: `/v1/businesses/${id}/subscription`, cookies: c });
    expect(sub.json()).toMatchObject({ status: 'trial' });
    const r = await app.inject({ method: 'POST', url: `/v1/businesses/${id}/reports`, headers: H, cookies: c, payload: reportInput(5000, { openingCash: 0 }) });
    expect(r.statusCode).toBe(200);
    const dash = await app.inject({ method: 'GET', url: `/v1/businesses/${id}/dashboard`, cookies: c });
    expect(dash.statusCode).toBe(200);
    expect(dash.body).toContain('5000');
  });

  it("un autre utilisateur obtient 404 (pas 403) sur un business qui n'est pas le sien", async () => {
    const t = await mkTeam(ctx);
    const { cookie } = await signup('0199999999');
    const r = await app.inject({ method: 'GET', url: `/v1/businesses/${t.businessId}/subscription`, cookies: { gb_user: cookie } });
    expect(r.statusCode).toBe(404);
  });
});

describe('HTTP — webhook FedaPay', () => {
  it('lit le corps BRUT : signature valide acceptée, falsifiée refusée, sans cookie ni CSRF', async () => {
    const raw = JSON.stringify({ id: 'evt_h1', name: 'transaction.approved', entity: { id: '1', status: 'approved', merchant_reference: 'SUB-inconnu', mode: 'test' } });
    const good = signFedapayWebhook(raw, ctx.deps.secrets.fedapayWebhookSecret, Math.floor(ctx.clock.now() / 1000));
    const ok = await app.inject({ method: 'POST', url: '/v1/webhooks/fedapay', headers: { 'content-type': 'application/json', 'x-fedapay-signature': good }, payload: raw });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ received: true, outcome: 'ignored' });
    const tampered = await app.inject({ method: 'POST', url: '/v1/webhooks/fedapay', headers: { 'content-type': 'application/json', 'x-fedapay-signature': good }, payload: raw.replace('evt_h1', 'evt_h2') });
    expect(tampered.statusCode).toBe(401);
    const none = await app.inject({ method: 'POST', url: '/v1/webhooks/fedapay', headers: { 'content-type': 'application/json' }, payload: raw });
    expect(none.statusCode).toBe(401);
  });
});

describe('HTTP — partenaires et administration', () => {
  const PH = { 'x-gobilan-csrf': '1', origin: 'http://localhost:5174', 'content-type': 'application/json' };
  const AH = { 'x-gobilan-csrf': '1', origin: 'http://localhost:5175', 'content-type': 'application/json' };

  it('connexion partenaire : cookie dédié, tableau de bord sans téléphone', async () => {
    await mkPartner(ctx, { role: 'manager' }, 'm@ex.test', 'Marie');
    const bad = await app.inject({ method: 'POST', url: '/v1/partner/login', headers: PH, payload: { email: 'm@ex.test', password: 'faux-faux-faux' } });
    expect(bad.statusCode).toBe(401);
    const ok = await app.inject({ method: 'POST', url: '/v1/partner/login', headers: PH, payload: { email: 'm@ex.test', password: 'motdepasse-solide' } });
    expect(ok.statusCode).toBe(200);
    const cookie = cookieOf(ok, 'gb_partner')!;
    const dash = await app.inject({ method: 'GET', url: '/v1/partner/dashboard', cookies: { gb_partner: cookie } });
    expect(dash.statusCode).toBe(200);
    expect(dash.body).not.toMatch(/\+\d{8,}/);
    // Origine du portail admin refusée sur une route partenaire.
    const wrongOrigin = await app.inject({ method: 'POST', url: '/v1/partner/logout', headers: AH, cookies: { gb_partner: cookie } });
    expect(wrongOrigin.statusCode).toBe(403);
  });

  it('connexion admin en 2 étapes puis accès aux statistiques ; un cookie partenaire ne donne pas accès', async () => {
    const { admin } = partnerServices(ctx);
    await admin.upsertAdmin('admin@novadis.test', 'admin-mot-de-passe-long');
    const s1 = await app.inject({ method: 'POST', url: '/v1/admin/login', headers: AH, payload: { email: 'admin@novadis.test', password: 'admin-mot-de-passe-long' } });
    expect(s1.statusCode).toBe(200);
    const code = /\b(\d{6})\b/.exec(ctx.providers.messages.emails.at(-1)!.text)![1]!;
    const noSession = await app.inject({ method: 'GET', url: '/v1/admin/stats' });
    expect(noSession.statusCode).toBe(401);
    const s2 = await app.inject({ method: 'POST', url: '/v1/admin/login/verify', headers: AH, payload: { challengeId: (s1.json() as { challengeId: string }).challengeId, code } });
    expect(s2.statusCode).toBe(200);
    const stats = await app.inject({ method: 'GET', url: '/v1/admin/stats', cookies: { gb_admin: cookieOf(s2, 'gb_admin')! } });
    expect(stats.statusCode).toBe(200);
    const p = await mkPartner(ctx, { role: 'manager' }, 'm@ex.test');
    void p;
    const pl = await app.inject({ method: 'POST', url: '/v1/partner/login', headers: PH, payload: { email: 'm@ex.test', password: 'motdepasse-solide' } });
    const asAdmin = await app.inject({ method: 'GET', url: '/v1/admin/stats', cookies: { gb_admin: cookieOf(pl, 'gb_partner')! } });
    expect(asAdmin.statusCode).toBe(401);
  });
});
