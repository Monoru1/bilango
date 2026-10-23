import { systemClock } from './clock';
import { createPgDb, createPgliteDb, migrate } from './db';
import { defaultConfig, type Deps } from './deps';
import { buildApp } from './http/app';
import { createDevProviders, DevPushTransport, type Providers } from './providers';
import { AdminService } from './services/admin';
import { startScheduler } from './services/jobs';
import { DbPushSender } from './services/push';

/**
 * Démarrage. Les fournisseurs réels (WhatsApp, e-mail, CAPTCHA, FedaPay, Web Push) ne sont PAS
 * encore implémentés (voir docs/CODEX_HANDOFF.md) : le serveur refuse donc de démarrer en
 * production avec les stubs de développement, pour qu'aucun faux envoi ne soit pris pour un vrai.
 */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

async function main() {
  const production = process.env.NODE_ENV === 'production';
  if (production) {
    throw new Error("Démarrage en production refusé : les fournisseurs réels ne sont pas branchés (stubs Dev uniquement). Voir docs/CODEX_HANDOFF.md.");
  }
  const db = process.env.DATABASE_URL ? await createPgDb(process.env.DATABASE_URL) : await createPgliteDb();
  const applied = await migrate(db);
  if (applied.length) process.stdout.write(`[api] migrations appliquées : ${applied.join(', ')}\n`);
  const providers: Providers = createDevProviders();
  // Outil de DÉVELOPPEMENT : les « envois » simulés sont écrits sur la sortie standard pour pouvoir tester les parcours.
  const wa = providers.messages.sendWhatsAppOtp.bind(providers.messages);
  const em = providers.messages.sendEmail.bind(providers.messages);
  providers.messages.sendWhatsAppOtp = async (phone, code) => {
    process.stdout.write(`[DEV WHATSAPP] ${phone} code=${code}\n`);
    return wa(phone, code);
  };
  providers.messages.sendEmail = async (to, m) => {
    process.stdout.write(`[DEV EMAIL] to=${to} subject=${m.subject}\n${m.text}\n[/DEV EMAIL]\n`);
    return em(to, m);
  };
  // Web Push : les abonnements sont réellement enregistrés en base, mais le TRANSPORT reste celui de développement
  // (aucun envoi vers un service push). Les points d'accès sont des secrets de capacité : jamais écrits dans les journaux.
  const pushTransport = new DevPushTransport();
  const send = pushTransport.send.bind(pushTransport);
  pushTransport.send = async (target, body) => {
    process.stdout.write(`[DEV PUSH] simulé (non envoyé) type=${(JSON.parse(body) as { type: string }).type}\n`);
    return send(target, body);
  };
  providers.push = new DbPushSender(db, systemClock, pushTransport);
  const deps: Deps = {
    db,
    clock: systemClock,
    secrets: {
      pepper: Buffer.from(requireEnv('PIN_PEPPER_HEX'), 'hex'),
      payoutKey: Buffer.from(requireEnv('PAYOUT_KEY_HEX'), 'hex'),
      fedapayWebhookSecret: requireEnv('FEDAPAY_WEBHOOK_SECRET'),
    },
    providers,
    config: { ...defaultConfig, vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null },
  };
  if (deps.secrets.pepper.length < 32 || deps.secrets.payoutKey.length !== 32) throw new Error('PIN_PEPPER_HEX (>=32 octets) et PAYOUT_KEY_HEX (32 octets) requis.');
  if (process.env.DEV_SEED_ADMIN_EMAIL && process.env.DEV_SEED_ADMIN_PASSWORD) {
    await new AdminService(deps).upsertAdmin(process.env.DEV_SEED_ADMIN_EMAIL, process.env.DEV_SEED_ADMIN_PASSWORD);
    process.stdout.write(`[api] administrateur de développement créé : ${process.env.DEV_SEED_ADMIN_EMAIL}\n`);
  }
  if (process.env.SCHEDULER !== '0') {
    startScheduler(deps, {
      onSummary: (s) => {
        if (s.reminders || s.expiring || s.errors.length || s.reconcile?.confirmed) process.stdout.write(`[scheduler] ${JSON.stringify(s)}\n`);
      },
    });
    process.stdout.write('[api] ordonnanceur démarré (rappels, expirations, rapprochement FedaPay horaire) — SCHEDULER=0 pour le désactiver\n');
  }
  const app = buildApp(deps, { secureCookies: false, rateLimit: true });
  const port = Number(process.env.PORT ?? 8787);
  await app.listen({ port, host: '127.0.0.1' });
  process.stdout.write(`[api] http://127.0.0.1:${port} — MODE DEV (fournisseurs simulés)\n`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
