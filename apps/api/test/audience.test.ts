import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { defaultConfig } from '../src/deps';
import { buildApp } from '../src/http/app';
import { AudienceService } from '../src/services/audience';
import { AuthService } from '../src/services/auth';
import { device, makeDeps, partnerServices } from './helpers';

const pwa = { origin: 'http://localhost:5173', 'x-gobilan-csrf': '1', 'user-agent': 'Mozilla/5.0' };
const adminHeaders = { origin: 'http://localhost:5175', 'x-gobilan-csrf': '1' };
const date = '2026-10-19';
const period = { from: date, to: date };
const reportUrl = '/v1/admin/audience?' + new URLSearchParams(period);

async function setup(enabled = true) {
  const ctx = await makeDeps({ config: { ...defaultConfig, ...(enabled ? { audience: { key: 'ab'.repeat(32), excludedIps: ['192.0.2.5'] } } : {}) } });
  const audience = new AudienceService(ctx.deps);
  if (enabled) await audience.start();
  const app = buildApp(ctx.deps, { secureCookies: true, rateLimit: false });
  return { ...ctx, audience, app };
}

it('ne collecte que les événements admissibles et déduplique les visites, installations et ouvertures', async () => {
  const { audience, db, app, clock } = await setup();
  const visitor = randomUUID();
  const session = randomUUID();
  const visit = { kind: 'visit', id: randomUUID(), visitor, session, platform: 'android', source: 'whatsapp' };
  const post = (payload: object, headers: Record<string, string> = pwa, remoteAddress = '192.0.2.6') =>
    app.inject({ method: 'POST', url: '/v1/audience/events', headers, payload, remoteAddress });
  try {
    expect((await post(visit, { ...pwa, origin: adminHeaders.origin })).statusCode).toBe(403);
    expect((await post({ ...visit, phone: 'private' })).statusCode).toBe(400);
    expect((await post({ ...visit, kind: 'registration' })).statusCode).toBe(400);
    await post(visit, { ...pwa, 'sec-gpc': '1' });
    await post(visit, { ...pwa, 'user-agent': 'ExampleBot' });
    await post(visit, pwa, '192.0.2.5');
    expect((await audience.report(date, date))?.total.visits).toBe(0);
    expect((await post(visit)).statusCode).toBe(204);
    await post({ ...visit, id: randomUUID() });
    await post({ ...visit, id: randomUUID(), session: randomUUID() });
    for (const kind of ['install_click', 'first_open', 'android_install']) {
      for (let i = 0; i < 2; i++) expect((await post({ kind, id: randomUUID(), visitor, platform: 'android' })).statusCode).toBe(204);
    }
    await post({ kind: 'android_install', id: randomUUID(), visitor: randomUUID(), platform: 'ios' });
    expect(await audience.report(date, date)).toMatchObject({
      collectionStartedOn: date,
      total: { visitors: 1, visits: 2, installClicks: 2, androidInstalls: 1, firstOpens: 1, registrations: 0 },
      sources: [{ source: 'whatsapp', counts: { visits: 2 } }],
    });
    const raw = JSON.stringify((await db.query('select * from audience_events')).rows);
    for (const sensitive of [visitor, session, visit.id, '192.0.2.6', 'Mozilla/5.0']) expect(raw).not.toContain(sensitive);

    clock.advance(86_400_000);
    await post({ ...visit, id: randomUUID() });
    expect(await audience.report(date, '2026-10-20')).toMatchObject({
      total: { visitors: 1, visits: 2 },
      days: [{ day: date, counts: { visits: 2 } }, { day: '2026-10-20', counts: { visits: 1 } }],
    });
    expect((await app.inject({ method: 'DELETE', url: '/v1/audience/events', headers: pwa, payload: { visitor } })).statusCode).toBe(204);
    expect((await audience.report(date, date))?.total.visits).toBe(0);

    await post({ ...visit, id: randomUUID() });
    clock.advance(90 * 86_400_000);
    await audience.prune();
    expect((await db.query('select * from audience_events')).rows).toHaveLength(0);
  } finally { await app.close(); }
});

it('compte une création après OTP, protège les exports et garde la collecte désactivée par défaut', async () => {
  const disabled = await setup(false);
  try {
    expect(await disabled.audience.report(date, date)).toBeNull();
    expect((await disabled.app.inject({ method: 'POST', url: '/v1/audience/events', headers: pwa, payload: {} })).statusCode).toBe(204);
    expect((await disabled.db.query('select * from audience_events')).rows).toHaveLength(0);
  } finally { await disabled.app.close(); }

  const ctx = await setup();
  const { app, audience } = ctx;
  const auth = new AuthService(ctx.deps);
  const phone = '0197000001';
  const d = device();
  const visitor = randomUUID();
  const pin = async (purpose: 'signup' | 'pin_reset') => {
    const input = { country: 'BJ' as const, phone, purpose, device: d };
    await auth.requestOtp({ ...input, captchaToken: 'ok' }, '192.0.2.6');
    const proof = await auth.verifyOtp({ ...input, code: ctx.providers.messages.lastCodeFor('+229' + phone)! });
    if (proof.kind !== 'pin_required') throw new Error('Preuve attendue');
    return app.inject({ method: 'POST', url: '/v1/auth/pin/create', headers: pwa,
      payload: { otpProof: proof.proof, pin: '4829', device: d, audience: { id: randomUUID(), visitor, platform: 'ios' } } });
  };
  try {
    expect((await pin('signup')).statusCode).toBe(200);
    ctx.clock.advance(120_000);
    expect((await pin('pin_reset')).statusCode).toBe(200);
    expect((await audience.report(date, date))?.total.registrations).toBe(1);
    expect((await app.inject({ url: reportUrl, cookies: { gb_partner: randomUUID() } })).statusCode).toBe(401);

    const { admin } = partnerServices(ctx);
    const email = 'audience@novadis.test';
    const password = 'admin-password-fixture';
    await admin.upsertAdmin(email, password);
    const challenge = await app.inject({ method: 'POST', url: '/v1/admin/login', headers: adminHeaders, payload: { email, password } });
    const code = /\b(\d{6})\b/.exec(ctx.providers.messages.emails.at(-1)!.text)![1]!;
    const login = await app.inject({ method: 'POST', url: '/v1/admin/login/verify', headers: adminHeaders,
      payload: { challengeId: challenge.json().challengeId, code } });
    const cookies = { gb_admin: login.cookies.find(cookie => cookie.name === 'gb_admin')!.value };
    const data = await app.inject({ url: reportUrl, cookies });
    expect(data.json()).toMatchObject({ report: { total: { registrations: 1 } } });
    const csvRequest = { method: 'POST' as const, url: '/v1/admin/audience/export', payload: period, cookies };
    expect((await app.inject(csvRequest)).statusCode).toBe(403);
    const csv = await app.inject({ ...csvRequest, headers: adminHeaders });
    expect(csv.statusCode).toBe(200);
    expect(csv.body).toContain('"Total","","0","0","0","0","0","1"');
    for (const secret of [visitor, email, phone]) {
      expect(csv.body).not.toContain(secret);
      expect(data.body).not.toContain(secret);
    }
    expect(await admin.auditLog()).toContainEqual(expect.objectContaining({ action: 'admin.audience.export', newValue: period }));
  } finally { await app.close(); }
});
