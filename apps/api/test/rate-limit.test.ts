import { beforeEach, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/http/app';
import { makeDeps, type Ctx } from './helpers';

// Régression : le limiteur de débit n'était appliqué à aucune route (plugin chargé après leur déclaration).
let ctx: Ctx;
let app: FastifyInstance;
beforeEach(async () => {
  ctx = await makeDeps();
  app = buildApp(ctx.deps, { secureCookies: true, rateLimit: true });
  await app.ready();
});
const H = { 'x-gobilan-csrf': '1', origin: 'http://localhost:5173', 'content-type': 'application/json' };

it('applique la limite globale et l’annonce dans les en-têtes', async () => {
  const res = await app.inject({ method: 'GET', url: '/v1/auth/config' });
  expect(res.statusCode).toBe(200);
  expect(res.headers['x-ratelimit-limit']).toBe('300');
  expect(Number(res.headers['x-ratelimit-remaining'])).toBe(299);
});

it('limite les routes d’authentification à 10 requêtes par minute et par adresse, sans toucher une autre adresse', async () => {
  const verify = (remoteAddress: string) => app.inject({ method: 'POST', url: '/v1/auth/otp/verify', remoteAddress, headers: H, payload: {} });
  const first = await Promise.all(Array.from({ length: 10 }, () => verify('192.0.2.10')));
  expect(first.map((r) => r.statusCode)).toEqual(Array(10).fill(400));
  const limited = await verify('192.0.2.10');
  expect(limited.statusCode).toBe(429);
  expect(limited.headers['retry-after']).toBeDefined();
  expect((await verify('192.0.2.11')).statusCode).toBe(400);
});

it('n’applique aucune limite à /health', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  expect(res.statusCode).toBe(200);
  expect(res.headers['x-ratelimit-limit']).toBeUndefined();
});
