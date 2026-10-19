import type { Access, CountryCode, PermissionLevel, Role, Subscription } from '@gobilan/domain';
import type { Db } from '../db';
import { notFound } from '../errors';

export interface BusinessRow {
  id: string;
  owner_id: string;
  name: string;
  country: CountryCode;
  sector: 'bar_restaurant' | 'boutique' | 'ecommerce' | 'other';
  stock_enabled: boolean;
  reminder_time: string;
  opening_cash_amount: string | null;
  opening_cash_day: string | null;
  opening_cash_by: string | null;
  trial_ends_at: Date | null;
  paid_until: Date | null;
  created_at: Date;
}

export interface AccessContext {
  access: Access;
  business: BusinessRow;
  memberId: string;
}

export const subscriptionOf = (b: Pick<BusinessRow, 'trial_ends_at' | 'paid_until'>): Pick<Subscription, 'paidUntil' | 'trialEndsAt'> => ({
  paidUntil: b.paid_until ? b.paid_until.toISOString() : null,
  trialEndsAt: b.trial_ends_at ? b.trial_ends_at.toISOString() : null,
});

/**
 * POINT DE CONTRÔLE UNIQUE du cloisonnement entre business (cahier §13.1) : tout service qui
 * touche à des données d'un business commence par cet appel. Sans appartenance ACTIVE, la
 * ressource est réputée introuvable (404) — jamais « interdite » — pour ne rien révéler.
 * `forUpdate` verrouille la ligne du business pour sérialiser les écritures concurrentes.
 */
export async function requireAccess(db: Db, userId: string, businessId: string, opts: { forUpdate?: boolean } = {}): Promise<AccessContext> {
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) throw notFound();
  const row = (
    await db.query<BusinessRow & { member_id: string; is_owner: boolean; role_id: string | null; role_name: string | null; level: PermissionLevel | null }>(
      `select b.*, m.id as member_id, m.is_owner, m.role_id, r.name as role_name, r.level
         from members m
         join businesses b on b.id = m.business_id
         left join roles r on r.id = m.role_id
        where m.user_id = $1 and m.business_id = $2 and m.status = 'active'
        ${opts.forUpdate ? 'for update of b' : ''}`,
      [userId, businessId],
    )
  ).rows[0];
  if (!row) throw notFound();
  const role: Role | null = row.role_id && row.role_name && row.level ? { id: row.role_id, businessId, name: row.role_name, level: row.level } : null;
  return {
    access: { businessId, userId, isOwner: row.is_owner, role },
    business: row,
    memberId: row.member_id,
  };
}
