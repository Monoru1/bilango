import { expect, it } from 'vitest';
import { buildApp } from '../src/http/app';
import { makeDeps, mkReferred, mkTeam, partnerServices, payFor, reportInput, services } from './helpers';

it('applique session, origine et CSRF et exporte uniquement des agrégats journalisés', async () => {
  const ctx = await makeDeps();
  const referred = await mkReferred(ctx);
  const trial = await mkTeam(ctx);
  await trial.addMember('Employée de test', trial.roles.full);
  await services(ctx).reports.submit(trial.owner.user, trial.businessId, reportInput(1000, { openingCash: 0 }));
  ctx.clock.advance(24 * 3600_000);
  expect(await (await payFor(ctx, referred.owner, referred.businessId)).send()).toBe('confirmed');

  const { admin } = partnerServices(ctx);
  const email = 'metrics@novadis.test';
  const password = 'admin-password-fixture';
  await admin.upsertAdmin(email, password);
  const app = buildApp(ctx.deps, { secureCookies: true, rateLimit: false });
  const origin = 'http://localhost:5175';
  const headers = { 'x-gobilan-csrf': '1', origin };
  const range = '?from=2026-10-19&to=2026-10-20';
  const url = '/v1/admin/metrics' + range;
  try {
    expect((await app.inject({ url, headers })).statusCode).toBe(401);
    const login = await app.inject({ method: 'POST', url: '/v1/admin/login', headers, payload: { email, password } });
    expect(login.statusCode).toBe(200);
    const code = /\b(\d{6})\b/.exec(ctx.providers.messages.emails.at(-1)!.text)![1]!;
    const session = await app.inject({ method: 'POST', url: '/v1/admin/login/verify', headers,
      payload: { challengeId: login.json().challengeId, code } });
    expect(session.statusCode).toBe(200);
    const cookies = { gb_admin: session.cookies.find(cookie => cookie.name === 'gb_admin')!.value };
    expect((await app.inject({ url, headers: { ...headers, origin: 'http://localhost:5174' }, cookies })).statusCode).toBe(403);
    expect((await app.inject({ url, headers: { origin }, cookies })).statusCode).toBe(403);
    expect((await app.inject({ url, headers, cookies: { gb_partner: referred.agent.id } })).statusCode).toBe(401);
    expect((await app.inject({ url: '/v1/admin/metrics?from=2026-02-30&to=2026-10-20', headers, cookies })).statusCode).toBe(400);
    expect((await app.inject({ url: '/v1/admin/metrics?from=2026-10-21&to=2026-10-20', headers, cookies })).statusCode).toBe(400);
    const sameOrigin = { 'x-gobilan-csrf': '1', 'sec-fetch-site': 'same-origin', 'x-gobilan-admin-origin': origin };
    expect((await app.inject({ url, headers: { ...sameOrigin, 'sec-fetch-site': 'cross-site' }, cookies })).statusCode).toBe(403);
    const data = await app.inject({ url, headers: sameOrigin, cookies });
    expect(data.statusCode).toBe(200);
    expect(data.json()).toMatchObject({
      acquisition: { accounts: 3, referredAccounts: 1 },
      activation: { businesses: 2, firstInvite: 1, firstReportWithin48h: 1, ratePercent: 50 },
      conversion: { trialsStarted: 2, trialsConverted: 1, averageDaysToFirstPayment: 1 },
      subscriptions: { trial: 1, active: 1, grace: 0, blocked: 0, trialByDaysRemaining: [{ days: 6, count: 1 }] },
      revenueByCountry: { BJ: 0, CI: 2000, TG: 0 },
      commissions: { agent: { due: 1000, paid: 0 }, manager: { due: 800, paid: 0 } },
    });
    const csv = await app.inject({ url: '/v1/admin/metrics.csv' + range, headers: sameOrigin, cookies });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-disposition']).toContain('attachment');
    expect(csv.body).toContain('"Revenus confirmés (FCFA)","CI","2000"');
    for (const privateValue of [referred.owner.user.phone, referred.owner.user.id, referred.businessId, email]) {
      expect(data.body).not.toContain(privateValue);
      expect(csv.body).not.toContain(privateValue);
    }
    expect(await admin.auditLog()).toContainEqual(expect.objectContaining({
      actor: email, action: 'admin.metrics.export', newValue: { from: '2026-10-19', to: '2026-10-20' },
    }));
  } finally {
    await app.close();
  }
});
