/** Four local servers; secrets stay in the ignored .env.local, simulated messages in .local/api.log. */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { loadEnvFile } from 'node:process';

if (process.env.NODE_ENV === 'production') throw new Error('Commande réservée au développement local.');
loadEnvFile('.env.local');
if (process.env.NODE_ENV === 'production') throw new Error('NODE_ENV=production interdit dans .env.local.');
for (const key of ['DATABASE_URL', 'PIN_PEPPER_HEX', 'PAYOUT_KEY_HEX', 'FEDAPAY_WEBHOOK_SECRET']) {
  if (!process.env[key]) throw new Error(`${key} requis dans .env.local. Voir docs/LOCAL_SETUP.md.`);
}
const database = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) throw new Error('Une base locale est requise.');
// Fail before starting any child; never attach the UI to an unrelated existing API.
for (const port of [8787, 5173, 5174, 5175]) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`Port ${port} occupé. Arrêter son serveur avant de relancer.`)));
    probe.listen(port, port === 8787 ? '127.0.0.1' : 'localhost', () => probe.close(resolve));
  });
}
await mkdir('.local', { recursive: true });
const children = [];
const preview = process.argv.includes('--preview');
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill();
}
function start(args, name) {
  const log = createWriteStream(`.local/${name}.log`, { flags: 'a' });
  const child = spawn(process.execPath, args, { env: { ...process.env, NODE_ENV: 'development' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  child.stdout.pipe(log); child.stderr.pipe(log);
  child.once('error', error => { process.stderr.write(`${name} : ${error.message}\n`); stop(1); });
  child.once('exit', code => { log.end(); if (!stopping) { process.stderr.write(`${name} arrêté (${code}). Voir .local/${name}.log.\n`); stop(1); } });
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
start(['--import', 'tsx', 'apps/api/src/server.ts'], 'api');
for (const [name, port] of [['pwa', 5173], ['partners', 5174], ['admin', 5175]]) {
  start(['node_modules/vite/bin/vite.js', ...(preview ? ['preview'] : []), `apps/${name}`, '--config', `apps/${name}/vite.config.ts`, '--host', 'localhost', '--port', String(port), '--strictPort'], name);
}
try {
  for (const url of ['http://127.0.0.1:8787/health', ...[5173, 5174, 5175].map(port => `http://localhost:${port}/`)]) {
    let ready = false;
    for (let attempt = 0; attempt < 240 && !stopping; attempt++) {
      try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch { /* bounded startup wait */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error(`Démarrage impossible : ${url}. Voir .local/*.log.`);
  }
  process.stdout.write('GoBilan LOCAL — fournisseurs externes DÉMO\nPWA : http://localhost:5173\nPartenaires : http://localhost:5174\nAdministration : http://localhost:5175\nAPI : http://127.0.0.1:8787/health\nOTP et e-mails simulés : .local/api.log\nIdentifiant admin : DEV_SEED_ADMIN_EMAIL / DEV_SEED_ADMIN_PASSWORD dans .env.local\nCtrl+C arrête les quatre applications ; PostgreSQL reste indépendant.\n');
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  stop(1);
}
