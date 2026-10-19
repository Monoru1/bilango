import { randomBytes } from 'node:crypto';
import { FakeClock } from '../src/clock';
import { createPgliteDb, migrate, type Db } from '../src/db';
import { defaultConfig, type Deps } from '../src/deps';
import { createDevProviders } from '../src/providers';

export const T0 = Date.parse('2026-10-19T10:00:00.000Z');

export async function makeDeps(over: Partial<Deps> = {}) {
  const db: Db = await createPgliteDb();
  await migrate(db);
  const clock = new FakeClock(T0);
  const providers = createDevProviders();
  const deps: Deps = {
    db,
    clock,
    providers,
    secrets: { pepper: randomBytes(32), payoutKey: randomBytes(32), fedapayWebhookSecret: 'whsec_test' },
    config: { ...defaultConfig },
    ...over,
  };
  return { deps, db, clock, providers };
}

export const device = (id = 'device-aaaaaaaa') => ({ deviceId: id, label: 'Test' });

import type { CountryCode } from '@gobilan/domain';
import { BusinessService } from '../src/services/business';
import { ReportService } from '../src/services/reports';
import { SubscriptionService } from '../src/services/subscriptions';
import type { SessionUser } from '../src/services/auth';

export type Ctx = Awaited<ReturnType<typeof makeDeps>>;

let counter = 0;

/** Crée un utilisateur + appareil directement en base (l'auth a ses propres tests). */
export async function mkUser(ctx: Ctx, name: string, country: CountryCode = 'BJ'): Promise<{ user: SessionUser; deviceRowId: string }> {
  counter += 1;
  const dial = country === 'BJ' ? '+229' : country === 'CI' ? '+225' : '+228';
  const national = country === 'TG' ? `9000${String(1000 + counter)}` : `01${String(10000000 + counter)}`;
  const phone = `${dial}${national}`;
  const u = (await ctx.db.query<{ id: string }>('insert into users(phone, country, name, created_at) values ($1,$2,$3,$4) returning id', [phone, country, name, new Date(ctx.clock.now()).toISOString()])).rows[0]!;
  const d = (
    await ctx.db.query<{ id: string }>('insert into devices(user_id, device_key, first_seen_at, last_seen_at) values ($1,$2,$3,$3) returning id', [u.id, `dev-${counter}-xxxxxxxx`, new Date(ctx.clock.now()).toISOString()])
  ).rows[0]!;
  return { user: { id: u.id, phone, name, country }, deviceRowId: d.id };
}

export function services(ctx: Ctx) {
  return { biz: new BusinessService(ctx.deps), reports: new ReportService(ctx.deps), subs: new SubscriptionService(ctx.deps) };
}

export const amount = (total: number) => ({ total, lines: [] as { label: string; amount: number }[] });
export const reportInput = (revenue: number, opts: { expenses?: number; cashIn?: number; openingCash?: number; id?: string; stock?: { itemId: string; quantity: number }[] } = {}) => ({
  content: { revenue: amount(revenue), expenses: amount(opts.expenses ?? 0), cashIn: amount(opts.cashIn ?? 0), stockSales: opts.stock ?? [], note: '' },
  ...(opts.openingCash !== undefined ? { openingCash: opts.openingCash } : {}),
  clientRequestId: opts.id ?? `req-${Math.random().toString(36).slice(2, 12)}`,
});

export async function expectCode(p: Promise<unknown>, code: string) {
  const { AppError } = await import('../src/errors');
  const err = await p.then(() => null, (e: unknown) => e);
  if (!(err instanceof AppError)) throw new Error(`Erreur AppError « ${code} » attendue, reçu : ${String(err)}`);
  if (err.code !== code) throw new Error(`Code attendu « ${code} », reçu « ${err.code} » (${err.message})`);
  return err;
}

/** Crée un business + une équipe : un propriétaire, un gérant « full », un caissier « entry ». */
export async function mkTeam(ctx: Ctx, opts: { country?: CountryCode; stock?: boolean } = {}) {
  const { biz } = services(ctx);
  const owner = await mkUser(ctx, 'Patron', opts.country ?? 'BJ');
  const { id } = await biz.createBusiness(owner.user, owner.deviceRowId, { name: 'Boutique Étoile', country: opts.country ?? 'BJ', sector: 'boutique', stockEnabled: opts.stock ?? false });
  const full = await biz.createRole(owner.user, id, { name: 'Gérant', level: 'full' });
  const entry = await biz.createRole(owner.user, id, { name: 'Caissière', level: 'entry' });
  const readonly = await biz.createRole(owner.user, id, { name: 'Comptable', level: 'readonly' });
  const addMember = async (name: string, roleId: string) => {
    const m = await mkUser(ctx, name, opts.country ?? 'BJ');
    const inv = await biz.invite(owner.user, id, { phone: m.user.phone, roleId });
    await biz.respondInvitation(m.user, inv.id, true);
    return m;
  };
  return { owner, businessId: id, roles: { full: full.id, entry: entry.id, readonly: readonly.id }, addMember };
}

import { signFedapayWebhook } from '../src/crypto';
import { AdminService } from '../src/services/admin';
import { AuthService } from '../src/services/auth';
import { PartnerService, type PartnerSession } from '../src/services/partners';

export const DAY_MS = 24 * 3600_000;

export function partnerServices(ctx: Ctx) {
  return { partners: new PartnerService(ctx.deps), admin: new AdminService(ctx.deps), auth: new AuthService(ctx.deps) };
}

/** Extrait le jeton du lien d'activation du dernier e-mail envoyé à `email`. */
export function activationToken(ctx: Ctx, email: string): string {
  const mail = [...ctx.providers.messages.emails].reverse().find((m) => m.to === email.toLowerCase() && m.text.includes('/activer?token='));
  if (!mail) throw new Error(`Aucun e-mail d'activation pour ${email}`);
  return /token=([\w-]+)/.exec(mail.text)![1]!;
}

export async function mkPartner(ctx: Ctx, kind: { role: 'manager' } | { role: 'influencer'; code: string } | { role: 'agent'; manager: PartnerSession; code: string; name?: string }, email: string, name = 'Partenaire', country: 'BJ' | 'CI' | 'TG' = 'CI') {
  const { partners } = partnerServices(ctx);
  if (kind.role === 'agent') await partners.registerAgent(kind.manager, { name: kind.name ?? name, email, promoCode: kind.code });
  else await partners.createByAdmin('admin@novadis.test', { name, country, email, role: kind.role, ...(kind.role === 'influencer' ? { promoCode: kind.code } : {}) });
  const a = await partners.activate(activationToken(ctx, email), 'motdepasse-solide', '1.0', '10.0.0.1');
  return a;
}

/** Simule le paiement d'un abonnement de bout en bout : checkout serveur -> passerelle approuve -> webhook signé. */
export async function payFor(ctx: Ctx, owner: { user: import('../src/services/auth').SessionUser }, businessId: string, opts: { eventId?: string; mode?: string } = {}) {
  const { subs } = services(ctx);
  const checkout = await subs.createCheckout(owner.user, businessId);
  const created = ctx.providers.gateway.created.find((c) => c.merchantReference === checkout.merchantReference)!;
  ctx.providers.gateway.states.set(created.transactionId, { transactionId: created.transactionId, merchantReference: checkout.merchantReference, status: 'approved', amount: 2000, provider: 'MTN' });
  const event = { id: opts.eventId ?? `evt_${Math.random().toString(36).slice(2)}`, name: 'transaction.approved', entity: { id: created.transactionId, status: 'approved', merchant_reference: checkout.merchantReference, amount: 2000, mode: opts.mode ?? 'test', custom_metadata: { business_id: businessId, type: 'renouvellement_abonnement' } } };
  return { checkout, created, event, send: () => sendWebhook(ctx, event) };
}

export function sendWebhook(ctx: Ctx, event: object, opts: { secret?: string; timestampSec?: number } = {}) {
  const raw = JSON.stringify(event);
  const header = signFedapayWebhook(raw, opts.secret ?? ctx.deps.secrets.fedapayWebhookSecret, opts.timestampSec ?? Math.floor(ctx.clock.now() / 1000));
  return services(ctx).subs.handleWebhook(raw, header);
}

/** Parrainage complet : manager -> agent -> commerçant inscrit avec le code de l'agent -> business créé. */
export async function mkReferred(ctx: Ctx, opts: { via?: 'agent' | 'influencer' } = {}) {
  const { auth } = partnerServices(ctx);
  const { biz } = services(ctx);
  let agentSession: PartnerSession | null = null;
  let managerSession: PartnerSession | null = null;
  let code: string;
  if ((opts.via ?? 'agent') === 'agent') {
    managerSession = (await mkPartner(ctx, { role: 'manager' }, 'manager@ex.test', 'Marie Manager')).partner;
    agentSession = (await mkPartner(ctx, { role: 'agent', manager: managerSession, code: 'KOFFI225', name: 'Koffi Agent' }, 'koffi@ex.test')).partner;
    code = 'KOFFI225';
  } else {
    agentSession = (await mkPartner(ctx, { role: 'influencer', code: 'AMINA' }, 'amina@ex.test', 'Amina Influence')).partner;
    code = 'AMINA';
  }
  const owner = await mkUser(ctx, 'Commerçant', 'CI');
  await auth.updateProfile(owner.user.id, 'Commerçant', code);
  const { id: businessId } = await biz.createBusiness(owner.user, owner.deviceRowId, { name: 'Boutique Étoile', country: 'CI', sector: 'boutique', stockEnabled: false });
  return { owner, businessId, agent: agentSession, manager: managerSession, code };
}
