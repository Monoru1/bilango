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
