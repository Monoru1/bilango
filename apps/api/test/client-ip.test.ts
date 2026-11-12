import { afterEach, beforeEach, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/http/app';
import { verifiedClientIp } from '../src/http/client-ip';
import { developmentRuntime } from '../src/runtime-config';
import { makeDeps } from './helpers';
// @ts-expect-error Netlify's JavaScript entry point has no declarations.
import { createApiProxy } from '../../../netlify/edge-functions/api-client-ip.js';

const key = 'fa'.repeat(32);
const endpoint = '/v1/auth/otp/request';
const origin = 'https://api.example.test';
const now = 1794477600000;
const env = new Map([['GOBILAN_PROXY_KEY_HEX', key], ['GOBILAN_EDGE_API_ORIGIN', origin]]);
let app: FastifyInstance;
let ctx: Awaited<ReturnType<typeof makeDeps>>;

beforeEach(async () => {
  ctx = await makeDeps();
  app = buildApp(ctx.deps, { secureCookies: true, rateLimit: true, proxyKey: key });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

async function edgeHeaders(ip: string, time: number, method = 'POST', path = endpoint) {
  let forwarded = new Headers();
  const handler = createApiProxy(env, async (target: URL, options: RequestInit) => {
    expect(target.origin).toBe(origin);
    expect(options.redirect).toBe('manual');
    forwarded = new Headers(options.headers);
    return new Response(null, { status: 204 });
  }, () => time);
  await handler(new Request('https://preview.example.test' + path, {
    method,
    headers: { 'x-gobilan-proxy': 'untrusted', 'x-forwarded-for': '203.0.113.99', 'content-type': 'application/json' },
  }), { ip });
  expect(forwarded.has('x-forwarded-for')).toBe(false);
  return Object.fromEntries(forwarded);
}

it('accepts the Netlify connection address only with a valid, fresh, request-bound proof', async () => {
  const proof = (await edgeHeaders('2001:0DB8::1', now))['x-gobilan-proxy'];
  const verify = (header: string | string[] | undefined, time = now, method = 'POST', path = endpoint) =>
    verifiedClientIp(header, key, method, path, time);
  expect(verify(proof)).toBe('2001:db8::1');
  expect(verify((await edgeHeaders('::ffff:192.0.2.1', now))['x-gobilan-proxy'])).toBe('192.0.2.1');
  for (const invalid of [undefined, 'invalid', proof?.replace('::1', '::2'), proof + ',' + proof, [proof!]]) {
    expect(verify(invalid)).toBeNull();
  }
  expect(verify(proof, now + 61_000)).toBeNull();
  expect(verify(proof, now - 6_000)).toBeNull();
  expect(verify(proof, now, 'GET')).toBeNull();
  expect(verify(proof, now, 'POST', endpoint + '?other=1')).toBeNull();
});

it('isolates client quotas and keeps direct requests in one conservative quota', async () => {
  const first = await edgeHeaders('192.0.2.1', ctx.clock.now());
  const second = await edgeHeaders('2001:db8::2', ctx.clock.now());
  const request = (id: number, proxyHeaders: Record<string, string> = {}) => app.inject({
    method: 'POST', url: endpoint, remoteAddress: '10.0.0.' + (id % 10 + 1),
    headers: {
      origin: 'http://localhost:5173', 'x-gobilan-csrf': '1', 'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.' + id, ...proxyHeaders,
    },
    payload: {
      country: 'BJ', phone: '01970000' + String(id).padStart(2, '0'), purpose: 'signup',
      device: { deviceId: 'proxy-device-' + id, label: 'test' }, captchaToken: 'ok',
    },
  });
  const parallel = await Promise.all(Array.from({ length: 10 }, (_, i) => request(i + 1, first)));
  expect(parallel.map(r => r.statusCode)).toEqual(Array(10).fill(200));
  expect((await request(11, first)).statusCode).toBe(429);
  expect((await request(12, second)).statusCode).toBe(200);
  const direct = await Promise.all(Array.from({ length: 10 }, (_, i) => request(i + 20, { 'x-gobilan-proxy': 'invalid' })));
  expect(direct.map(r => r.statusCode)).toEqual(Array(10).fill(200));
  const limited = await request(30);
  expect(limited.statusCode).toBe(429);
  expect(limited.headers['retry-after']).toBeDefined();
  // Replacing the process resets Fastify's minute counters but keeps the daily database quota.
  await app.close();
  app = buildApp(ctx.deps, { secureCookies: true, rateLimit: true, proxyKey: key });
  expect((await request(31, first)).json()).toMatchObject({ error: { message: 'Trop de demandes depuis ce réseau. Réessayez plus tard.' } });
  expect((await request(32)).json()).toMatchObject({ error: { message: 'Trop de demandes depuis ce réseau. Réessayez plus tard.' } });
  const db = await ctx.db.query<{ ip: string; n: number }>('select ip, count(*)::int as n from otp_codes group by ip');
  expect(Object.fromEntries(db.rows.map(({ ip, n }) => [ip, n]))).toEqual({
    '192.0.2.1': 10, '2001:db8::2': 1, 'direct-without-verified-client-ip': 10,
  });
});

it('rejects a malformed configured key during API startup', () => {
  expect(developmentRuntime({}).proxyKey).toBeUndefined();
  expect(developmentRuntime({ GOBILAN_PROXY_KEY_HEX: key }).proxyKey).toBe(key);
  expect(() => developmentRuntime({ GOBILAN_PROXY_KEY_HEX: 'bad' })).toThrow('invalid_gobilan_proxy_key');
});
