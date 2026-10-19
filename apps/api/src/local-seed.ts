/** Explicit fictitious development fixtures. Never imported by the API server. */
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { AGREEMENT_VERSION } from '@gobilan/domain';
import { systemClock } from './clock';
import { createPgDb, migrate } from './db';
import { defaultConfig, type Deps } from './deps';
import { createDevProviders } from './providers';
import { AdminService } from './services/admin';
import { AuthService } from './services/auth';
import { BusinessService } from './services/business';
import { PartnerService } from './services/partners';
import { ReportService } from './services/reports';

if (process.env.NODE_ENV === 'production') throw new Error('Fixtures locales interdites en production.');
const url = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.searchParams.get('options') !== '-c search_path=gobilan_local') {
  throw new Error('Une base loopback et le schéma dédié gobilan_local sont requis. Voir LOCAL_SETUP.md.');
}
const db = await createPgDb(url.toString());
try {
  await migrate(db);
  const previous = await readFile('.local/accounts.json', 'utf8').then(JSON.parse, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
  if (previous && (await db.query('select id from businesses where id=$1', [previous.businessId])).rows.length) {
    process.stdout.write('Comptes déjà préparés : .local/accounts.json (aucune réinitialisation).\n');
  } else {
    const providers = createDevProviders();
    const secrets = {
      pepper: Buffer.from(process.env.PIN_PEPPER_HEX ?? '', 'hex'),
      payoutKey: Buffer.from(process.env.PAYOUT_KEY_HEX ?? '', 'hex'),
      fedapayWebhookSecret: process.env.FEDAPAY_WEBHOOK_SECRET ?? '',
    };
    if (secrets.pepper.length < 32 || secrets.payoutKey.length !== 32 || !secrets.fedapayWebhookSecret) throw new Error('Secrets locaux manquants.');
    const credentials = await db.tx(async t => {
      if ((await t.query('select id from users limit 1')).rows.length) throw new Error('Schéma déjà utilisé sans fichier de comptes correspondant : aucune donnée modifiée.');
      const deps: Deps = { db: t, clock: systemClock, secrets, providers, config: defaultConfig };
      const auth = new AuthService(deps); const biz = new BusinessService(deps); const partners = new PartnerService(deps);
      const user = async (phone: string, name: string) => {
        const device = { deviceId: `local-seed-${randomUUID()}`, label: 'DÉMO locale' };
        const pin = String(randomInt(1000, 10000));
        await auth.requestOtp({ country: 'BJ', phone, purpose: 'signup', device, captchaToken: 'local-demo' }, null);
        const code = providers.messages.lastCodeFor(phone)!;
        const proof = await auth.verifyOtp({ country: 'BJ', phone, purpose: 'signup', device, code });
        if (proof.kind !== 'pin_required') throw new Error('Compte fictif déjà présent.');
        const session = await auth.createPin({ otpProof: proof.proof, pin, device });
        await auth.updateProfile(session.user.id, name);
        session.user.name = name;
        return { session, credentials: { name, phone, pin } };
      };
      const owner = await user('+2290197000001', 'Patron Démo');
      const business = await biz.createBusiness(owner.session.user, owner.session.deviceId, { name: 'Boutique Démo locale', country: 'BJ', sector: 'boutique', stockEnabled: true });
      const users = [owner.credentials];
      for (const [phone, name, level] of [['+2290197000002', 'Gérant Démo', 'full'], ['+2290197000003', 'Caissier Démo', 'entry'], ['+2290197000004', 'Comptable Démo', 'readonly']] as const) {
        const member = await user(phone, name);
        const role = await biz.createRole(owner.session.user, business.id, { name, level });
        const invitation = await biz.invite(owner.session.user, business.id, { phone, roleId: role.id });
        await biz.respondInvitation(member.session.user, invitation.id, true);
        users.push(member.credentials);
      }
      await biz.addStockItem(owner.session.user, business.id, { name: 'Riz', initialQuantity: 100 });
      await new ReportService(deps).submit(owner.session.user, business.id, {
        clientRequestId: randomUUID(), openingCash: 10000,
        content: { revenue: { total: 48500, lines: [] }, expenses: { total: 6000, lines: [] }, cashIn: { total: 0, lines: [] }, stockSales: [], note: 'DÉMO : données fictives de recette locale.' },
      });
      const admins = [];
      for (const email of [process.env.DEV_SEED_ADMIN_EMAIL ?? 'admin@novadis.test', 'secours@novadis.test']) {
        const password = email === process.env.DEV_SEED_ADMIN_EMAIL ? process.env.DEV_SEED_ADMIN_PASSWORD : randomBytes(18).toString('base64url');
        if (!password || password.length < 12) throw new Error('DEV_SEED_ADMIN_PASSWORD >= 12 caractères requis.');
        await new AdminService(deps).upsertAdmin(email, password);
        admins.push({ email, password });
      }
      const activate = async (email: string) => {
        const password = randomBytes(18).toString('base64url');
        const text = [...providers.messages.emails].reverse().find(message => message.to === email)!.text;
        const token = text.match(/activer\?token=([\w-]+)/)![1]!;
        const result = await partners.activate(token, password, AGREEMENT_VERSION, null);
        return { result, credentials: { email, password, role: result.partner.role } };
      };
      await partners.createByAdmin(admins[0]!.email, { email: 'manager@partner.test', name: 'Marie Démo', country: 'BJ', role: 'manager' });
      const manager = await activate('manager@partner.test');
      await partners.registerAgent(manager.result.partner, { email: 'agent@partner.test', name: 'Koffi Démo', promoCode: 'KOFFI229' });
      const agent = await activate('agent@partner.test');
      await partners.createByAdmin(admins[0]!.email, { email: 'influenceur@partner.test', name: 'Influenceur Démo', country: 'BJ', role: 'influencer', promoCode: 'DEMO229' });
      const influencer = await activate('influenceur@partner.test');
      return { mode: 'DÉMO — identités et acceptations fictives, aucun service externe', businessId: business.id, users, admins, partners: [manager.credentials, agent.credentials, influencer.credentials] };
    });
    await mkdir('.local', { recursive: true });
    await writeFile('.local/accounts.json', JSON.stringify(credentials, null, 2), { mode: 0o600 });
    process.stdout.write('Comptes fictifs préparés : .local/accounts.json. Sur un nouvel appareil, utiliser un OTP Dev avant le PIN.\n');
  }
} finally { await db.close(); }
