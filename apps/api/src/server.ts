import { systemClock } from './clock';
import { createPgDb, createPgliteDb, migrate } from './db';
import { defaultConfig, type Deps } from './deps';
import { buildApp } from './http/app';
import { createDevProviders } from './providers';
import { AdminService } from './services/admin';

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
  const providers = createDevProviders();
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
  const deps: Deps = {
    db,
    clock: systemClock,
    secrets: {
      pepper: Buffer.from(requireEnv('PIN_PEPPER_HEX'), 'hex'),
      payoutKey: Buffer.from(requireEnv('PAYOUT_KEY_HEX'), 'hex'),
      fedapayWebhookSecret: requireEnv('FEDAPAY_WEBHOOK_SECRET'),
    },
    providers,
    config: defaultConfig,
  };
  if (deps.secrets.pepper.length < 32 || deps.secrets.payoutKey.length !== 32) throw new Error('PIN_PEPPER_HEX (>=32 octets) et PAYOUT_KEY_HEX (32 octets) requis.');
  if (process.env.DEV_SEED_ADMIN_EMAIL && process.env.DEV_SEED_ADMIN_PASSWORD) {
    await new AdminService(deps).upsertAdmin(process.env.DEV_SEED_ADMIN_EMAIL, process.env.DEV_SEED_ADMIN_PASSWORD);
    process.stdout.write(`[api] administrateur de développement créé : ${process.env.DEV_SEED_ADMIN_EMAIL}\n`);
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
