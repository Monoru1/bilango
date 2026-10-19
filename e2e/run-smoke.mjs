/** Isolated, disposable E2E schema; never migrate or reset a user's application schema. */
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
const source = process.env.E2E_DATABASE_URL;
if (!source) throw new Error('E2E_DATABASE_URL requis (base de test PostgreSQL dédiée).');
const schema = `gobilan_e2e_${randomUUID().replaceAll('-', '')}`;
const db = new pg.Client({ connectionString: source });
const children = [];
const directory = await mkdtemp(join(tmpdir(), 'gobilan-e2e-'));
const artifacts = join(directory, 'artifacts');
await mkdir(artifacts);
console.log(`Journaux et preuves E2E : ${directory}`);
const url = new URL(source); url.searchParams.set('options', `-c search_path=${schema}`);
const env = {
  ...process.env, DATABASE_URL: url.toString(),
  PIN_PEPPER_HEX: randomBytes(32).toString('hex'), PAYOUT_KEY_HEX: randomBytes(32).toString('hex'), FEDAPAY_WEBHOOK_SECRET: randomBytes(32).toString('hex'),
  DEV_SEED_ADMIN_EMAIL: 'admin@novadis.test', DEV_SEED_ADMIN_PASSWORD: 'dev-admin-password-123',
  API_LOG: join(directory, 'api.log'), E2E_ARTIFACTS: artifacts, NODE_ENV: 'development',
};
function start(args, name) {
  const log = createWriteStream(join(directory, `${name}.log`));
  const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log); child.stderr.pipe(log);
  const exited = new Promise(resolve => child.once('exit', resolve)); children.push({ child, exited, log });
  return child;
}
async function ready(address) {
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(address)).ok) return; } catch { /* startup */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Démarrage impossible : ${address}. Journaux : ${directory}`);
}
async function run(script) {
  const p = spawn(process.execPath, [script], { env, stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => { p.once('error', reject); p.once('exit', resolve); });
  if (code !== 0) throw new Error(`${script} a échoué (code ${code}). Journaux : ${directory}`);
}
try {
  await db.connect(); await db.query(`create schema ${schema}`);
  start(['--import', 'tsx', 'apps/api/src/server.ts'], 'api');
  for (const [name, port] of [['pwa', 5173], ['partners', 5174], ['admin', 5175]]) start(['node_modules/vite/bin/vite.js', `apps/${name}`, '--config', `apps/${name}/vite.config.ts`, '--port', String(port), '--strictPort'], name);
  await Promise.all([ready('http://127.0.0.1:8787/health'), ...[5173, 5174, 5175].map(p => ready(`http://localhost:${p}/`))]);
  await run('e2e/pwa-smoke.mjs'); await run('e2e/portals-smoke.mjs'); await run('e2e/installation-smoke.mjs');
} finally {
  for (const { child } of children) child.kill('SIGTERM');
  await Promise.all(children.map(async ({ exited, log }) => { await exited; log.end(); }));
  await db.query(`drop schema if exists ${schema} cascade`).catch(() => undefined); await db.end();
}
