import {
  computeCommissions,
  payoutDateFor,
  reversalOf,
  subscriptionStatus,
  type CommissionLine,
  type LedgerEntry,
  type Referral,
} from '@gobilan/domain';
import { iso } from '../clock';
import type { Db } from '../db';

interface ReferralRow {
  id: string;
  business_id: string;
  partner_id: string;
  partner_role: 'agent' | 'influencer';
  manager_id: string | null;
  registered_at: Date;
  rates: Referral['rates'];
  agreement_version: string;
  excluded_reason: string | null;
}

const toReferral = (r: ReferralRow): Referral => ({
  id: r.id,
  businessId: r.business_id,
  partnerId: r.partner_id,
  partnerRole: r.partner_role,
  managerId: r.manager_id,
  registeredAt: r.registered_at.toISOString(),
  rates: r.rates,
  agreementVersion: r.agreement_version,
  excludedReason: r.excluded_reason,
});

/**
 * Enregistre les commissions d'UN paiement confirmé, dans la transaction du webhook.
 * Idempotent : la clé `paymentId:rôle` est unique dans le journal, rejouer ne double rien.
 * `statusBefore` = statut de l'abonnement AVANT prolongation (le client « renouvelle-t-il » ?).
 */
export async function recordCommissionsForPayment(
  t: Db,
  payment: { id: string; businessId: string; confirmedAt: number; amount: number },
  statusBefore: ReturnType<typeof subscriptionStatus>,
): Promise<{ inserted: CommissionLine[]; skipped: string | null }> {
  const refRow = (await t.query<ReferralRow>('select * from referrals where business_id = $1', [payment.businessId])).rows[0];
  if (!refRow) return { inserted: [], skipped: 'no_referral' };
  const referral = toReferral(refRow);

  // Paiements déjà commissionnés pour ce parrainage (lignes positives non annulées, rôle principal).
  const prior = (
    await t.query<{ payment_id: string; confirmed_at: Date }>(
      `select l.payment_id, l.confirmed_at from commission_ledger l
        where l.referral_id = $1 and l.role in ('agent','influencer') and l.amount > 0
          and not exists (select 1 from commission_ledger r where r.reverses = l.key)
        order by l.confirmed_at`,
      [referral.id],
    )
  ).rows;
  if (prior.some((p) => p.payment_id === payment.id)) return { inserted: [], skipped: 'already_recorded' };

  const confirmedIso = iso(payment.confirmedAt);
  const result = computeCommissions(
    referral,
    { id: payment.id, businessId: payment.businessId, confirmedAt: confirmedIso, amount: payment.amount },
    {
      priorCommissionedPayments: prior.length,
      firstPaymentAt: prior[0] ? prior[0].confirmed_at.toISOString() : null,
      renewedWhileEntitled: statusBefore !== 'blocked',
    },
  );
  const payoutDate = payoutDateFor(confirmedIso);
  for (const line of result.lines) {
    await t.query(
      `insert into commission_ledger(key, partner_id, role, referral_id, payment_id, amount, payout_date, confirmed_at, payment_index, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$8) on conflict (key) do nothing`,
      [line.key, line.partnerId, line.role, line.referralId, line.paymentId, line.amount, payoutDate, confirmedIso, line.paymentIndex],
    );
  }
  return { inserted: result.lines, skipped: result.skipped };
}

/** Annule les commissions d'un paiement remboursé / contesté : lignes négatives, jamais de modification (§13.4). */
export async function reverseCommissionsForPayment(t: Db, paymentId: string, reason: string, now: number): Promise<number> {
  const lines = (
    await t.query<{ key: string; partner_id: string; role: LedgerEntry['role']; referral_id: string; amount: string; payout_date: string; confirmed_at: Date }>(
      `select key, partner_id, role, referral_id, amount, payout_date, confirmed_at from commission_ledger l
        where payment_id = $1 and amount > 0 and not exists (select 1 from commission_ledger r where r.reverses = l.key)`,
      [paymentId],
    )
  ).rows;
  return reverseLines(t, lines, reason, now);
}

export async function reverseCommissionsForReferral(t: Db, referralId: string, reason: string, now: number): Promise<number> {
  const lines = (
    await t.query<{ key: string; partner_id: string; role: LedgerEntry['role']; referral_id: string; amount: string; payout_date: string; confirmed_at: Date }>(
      `select key, partner_id, role, referral_id, amount, payout_date, confirmed_at from commission_ledger l
        where referral_id = $1 and amount > 0 and not exists (select 1 from commission_ledger r where r.reverses = l.key)`,
      [referralId],
    )
  ).rows;
  return reverseLines(t, lines, reason, now);
}

async function reverseLines(
  t: Db,
  lines: { key: string; partner_id: string; role: LedgerEntry['role']; referral_id: string; amount: string; payout_date: string; confirmed_at: Date }[],
  reason: string,
  now: number,
): Promise<number> {
  const at = iso(now);
  const payoutDate = payoutDateFor(at);
  for (const l of lines) {
    const entry: LedgerEntry = { key: l.key, partnerId: l.partner_id, role: l.role, referralId: l.referral_id, amount: Number(l.amount), payoutDate: l.payout_date, confirmedAt: l.confirmed_at.toISOString(), reverses: null };
    const rev = reversalOf(entry, reason, at, payoutDate);
    await t.query(
      `insert into commission_ledger(key, partner_id, role, referral_id, payment_id, amount, payout_date, confirmed_at, reverses, created_at)
       select $1,$2,$3,$4,payment_id,$5,$6,$7,$8,$7 from commission_ledger where key = $8 on conflict (key) do nothing`,
      [rev.key, rev.partnerId, rev.role, rev.referralId, rev.amount, rev.payoutDate, at, l.key],
    );
  }
  return lines.length;
}
