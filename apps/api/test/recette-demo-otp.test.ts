import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/http/app';
import { recetteDemoOtp, recetteMessageSender } from '../src/recette-demo-otp';
import { makeDeps, T0, type Ctx } from './helpers';

const MIN = 60_000;
const DEMO_PHONE = '+2290197000001';
const DEMO_NAT = '0197000001';
const OTHER_NAT = '0197000002';
const CODE = '4827';
const env = {
  NODE_ENV: 'recette',
  RENDER_RECETTE: 'true',
  DATABASE_URL: 'postgresql://fixture:fixture@dpg-dbopc7brjlhs73bjik8g-a/gobilan_recette',
  RECETTE_DEMO_PHONES: `${DEMO_PHONE}, +22890000001`,
  RECETTE_DEMO_OTP: CODE,
  RECETTE_DEMO_OTP_EXPIRES_AT: new Date(T0 + 3 * 24 * 60 * MIN).toISOString(),
};

describe('configuration de l’OTP de démonstration', () => {
  it('n’existe pas hors recette et refuse toute configuration hors recette ou en production', () => {
    expect(recetteDemoOtp({}, T0)).toBeNull();
    expect(recetteDemoOtp({ NODE_ENV: 'production', PRODUCTION_RELEASE_APPROVED: 'true', PROVIDER_MODE: 'configured' }, T0)).toBeNull();
    for (const over of [{ NODE_ENV: 'production' }, { RENDER_RECETTE: undefined }, { RENDER_RECETTE: 'false' }, { NODE_ENV: 'production', PRODUCTION_RELEASE_APPROVED: 'true' }]) {
      expect(() => recetteDemoOtp({ ...env, ...over }, T0)).toThrow('recette_demo_otp_forbidden');
    }
    // Une seule variable résiduelle suffit à bloquer un démarrage hors recette.
    expect(() => recetteDemoOtp({ NODE_ENV: 'production', RECETTE_DEMO_OTP: CODE }, T0)).toThrow('recette_demo_otp_forbidden');
    expect(() => recetteDemoOtp({ RECETTE_DEMO_PHONES: DEMO_PHONE }, T0)).toThrow('recette_demo_otp_forbidden');
  });

  it('exige la base de recette dédiée et l’absence de fournisseur réel', () => {
    expect(() => recetteDemoOtp({ ...env, DATABASE_URL: 'postgresql://u:p@dpg-other-a/gobilan_recette' }, T0)).toThrow('dedicated_recette_database_required');
    expect(() => recetteDemoOtp({ ...env, DATABASE_URL: undefined }, T0)).toThrow('dedicated_recette_database_required');
    expect(() => recetteDemoOtp({ ...env, PROVIDER_MODE: 'configured' }, T0)).toThrow('recette_demo_otp_conflicts_with_configured_providers');
  });

  it('rejette une liste, un code ou une échéance invalides', () => {
    for (const phones of ['', '0197000001', '+33612345678', `${DEMO_PHONE},${DEMO_PHONE}`, Array.from({ length: 21 }, (_, i) => `+22901970000${String(i).padStart(2, '0')}`).join(',')]) {
      expect(() => recetteDemoOtp({ ...env, RECETTE_DEMO_PHONES: phones }, T0)).toThrow(phones === '' ? /recette_demo_/ : 'recette_demo_phones_invalid');
    }
    for (const code of ['', '123', '12345', 'abcd', '0000', '7777', '1234', '4321']) {
      expect(() => recetteDemoOtp({ ...env, RECETTE_DEMO_OTP: code }, T0)).toThrow(/recette_demo_/);
    }
    for (const expiry of ['', 'demain', '2026-11-20', new Date(T0 + 32 * 24 * 60 * MIN).toISOString()]) {
      expect(() => recetteDemoOtp({ ...env, RECETTE_DEMO_OTP_EXPIRES_AT: expiry }, T0)).toThrow(/recette_demo_/);
    }
  });

  it('ne délivre le code qu’aux numéros listés et seulement avant l’échéance', () => {
    const policy = recetteDemoOtp(env, T0)!;
    expect(policy.codeFor(DEMO_PHONE, T0)).toBe(CODE);
    expect(policy.codeFor('+22890000001', T0)).toBe(CODE);
    expect(policy.codeFor('+2290197000002', T0)).toBeNull();
    expect(policy.codeFor(DEMO_PHONE, T0 + 3 * 24 * 60 * MIN)).toBeNull();
    // Échéance déjà passée au démarrage : le service démarre, mais plus aucun code n'est émis.
    expect(recetteDemoOtp(env, T0 + 4 * 24 * 60 * MIN)!.codeFor(DEMO_PHONE, T0 + 4 * 24 * 60 * MIN)).toBeNull();
  });

  it('refuse tous les numéros en recette tant que rien n’est configuré', () => {
    const policy = recetteDemoOtp({ NODE_ENV: 'recette', RENDER_RECETTE: 'true', DATABASE_URL: env.DATABASE_URL }, T0)!;
    expect(policy.codeFor(DEMO_PHONE, T0)).toBeNull();
  });
});

describe('journaux de la recette', () => {
  it('n’écrit ni code, ni numéro, ni destinataire, ni corps de message', async () => {
    const lines: string[] = [];
    const sender = recetteMessageSender((line) => lines.push(line));
    await sender.sendWhatsAppOtp(DEMO_PHONE, CODE);
    await sender.sendEmail('partenaire@example.test', { subject: 'Activation', text: 'https://partners.example.test/activer?token=secret-fixture' });
    const out = lines.join('\n');
    expect(lines).toHaveLength(2);
    for (const leak of [CODE, DEMO_PHONE, DEMO_NAT, 'partenaire@example.test', 'secret-fixture', 'Activation']) expect(out).not.toContain(leak);
  });
});

describe('parcours HTTP avec OTP de démonstration', () => {
  let ctx: Ctx;
  let app: FastifyInstance;
  const H = { 'x-gobilan-csrf': '1', origin: 'http://localhost:5173', 'content-type': 'application/json' };
  const device = { deviceId: 'device-demo-0001', label: 'test' };
  const request = (phone: string, dev = device) => app.inject({ method: 'POST', url: '/v1/auth/otp/request', headers: H, payload: { country: 'BJ', phone, purpose: 'signup', device: dev, captchaToken: 'ok' } });
  const verify = (phone: string, code: string) => app.inject({ method: 'POST', url: '/v1/auth/otp/verify', headers: H, payload: { country: 'BJ', phone, purpose: 'signup', code, device } });

  beforeEach(async () => {
    ctx = await makeDeps();
    ctx.deps.config.demoOtp = recetteDemoOtp(env, T0);
    Object.assign(ctx.providers.messages, recetteMessageSender(() => undefined));
    app = buildApp(ctx.deps, { secureCookies: true, rateLimit: false });
    await app.ready();
  });

  it('annonce la simulation dans /v1/auth/config sans jamais exposer le code ni la liste', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/auth/config' });
    expect(res.json()).toMatchObject({ demo: { whatsappSimulated: true } });
    expect(res.body).not.toContain(CODE);
    expect(res.body).not.toContain(DEMO_PHONE);
  });

  it('n’annonce aucune simulation hors recette', async () => {
    const plain = buildApp((await makeDeps()).deps, { secureCookies: true, rateLimit: false });
    expect((await plain.inject({ method: 'GET', url: '/v1/auth/config' })).json()).toMatchObject({ demo: { whatsappSimulated: false } });
  });

  it('refuse explicitement un numéro hors liste, sans émettre ni compter de code', async () => {
    const res = await request(OTHER_NAT);
    expect(res.statusCode).toBe(403);
    expect(res.body).not.toContain(CODE);
    expect((await ctx.db.query('select 1 from otp_codes')).rows).toHaveLength(0);
    expect((await verify(OTHER_NAT, CODE)).statusCode).toBe(400);
  });

  it('connecte un compte de démonstration avec le code de test, à usage unique, sans le renvoyer', async () => {
    const res = await request(DEMO_NAT);
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain(CODE);
    expect(ctx.providers.messages.whatsapp).toHaveLength(0);
    const ok = await verify(DEMO_NAT, CODE);
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { kind: string }).kind).toBe('pin_required');
    expect((await verify(DEMO_NAT, CODE)).statusCode).toBe(400);
  });

  it('exige une demande préalable : le code seul n’ouvre rien', async () => {
    expect((await verify(DEMO_NAT, CODE)).statusCode).toBe(400);
  });

  it('conserve les essais comptés, l’expiration et le quota', async () => {
    expect((await request(DEMO_NAT)).statusCode).toBe(200);
    let last = 0;
    for (let i = 0; i < 6 && last !== 429; i++) last = (await verify(DEMO_NAT, '9999')).statusCode;
    expect(last).toBe(429);
    expect((await verify(DEMO_NAT, CODE)).statusCode).toBe(429);

    ctx.clock.advance(3 * MIN);
    expect((await request(DEMO_NAT)).statusCode).toBe(200);
    ctx.clock.advance(30 * MIN);
    expect((await verify(DEMO_NAT, CODE)).statusCode).toBe(400);

    let quota = 0;
    for (let i = 0; i < 8 && quota !== 429; i++) { ctx.clock.advance(3 * MIN); quota = (await request(DEMO_NAT)).statusCode; }
    expect(quota).toBe(429);
  });

  it('cesse d’émettre à l’échéance du code de test', async () => {
    ctx.clock.advance(3 * 24 * 60 * MIN + MIN);
    expect((await request(DEMO_NAT)).statusCode).toBe(403);
  });
});
