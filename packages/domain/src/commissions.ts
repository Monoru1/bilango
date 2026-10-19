/**
 * Programme partenaires — règles de commission (cahier §10.8, annexe D v1.0).
 * Fonctions pures : elles ne lisent ni la base ni l'horloge. Le serveur fournit l'historique
 * des paiements confirmés (webhook vérifié) et persiste le résultat dans un journal
 * append-only ; une correction passe par une ligne d'annulation, jamais par une mise à jour.
 */
import { DAY_MS } from './dates';
import type { Id, IsoDateTime } from './types';

export type PartnerRole = 'agent' | 'manager' | 'influencer';

export interface RateCard {
  /** Commission sur le premier paiement de la personne parrainée (FCFA, brut). */
  first: number;
  /** Commission sur chacun des renouvellements suivants (FCFA, brut). */
  renewal: number;
}

/** Montants FIXÉS par l'accord (§10.8). Aucune saisie admin ne les modifie (§10.4). */
export const AGREEMENT_VERSION = '1.0';
export const RATE_CARDS: Readonly<Record<PartnerRole, RateCard>> = {
  agent: { first: 1000, renewal: 500 },
  manager: { first: 800, renewal: 500 },
  influencer: { first: 1800, renewal: 1000 },
};
/** Au plus 12 paiements commissionnés par personne parrainée (1 premier + 11 renouvellements). */
export const MAX_COMMISSIONED_PAYMENTS = 12;
export const COMMISSION_DURATION_MONTHS = 12;
/** Le premier paiement doit intervenir dans les 30 jours suivant l'inscription (§10.8). */
export const REFERRAL_WINDOW_DAYS = 30;

export type ReferralStatus = 'trial' | 'paid' | 'expired';

export interface Referral {
  id: Id;
  businessId: Id;
  /** Partenaire détenteur du code (agent ou influenceur ; jamais un manager, §10.5). */
  partnerId: Id;
  partnerRole: Exclude<PartnerRole, 'manager'>;
  /** Manager de l'agent au moment du parrainage, `null` sinon. */
  managerId: Id | null;
  registeredAt: IsoDateTime;
  /**
   * Montants figés à la date du parrainage pour toute la durée de rémunération : une nouvelle
   * version d'accord ne concerne que les nouveaux parrainages (§10.3, §10.8).
   */
  rates: Readonly<Record<PartnerRole, RateCard>>;
  agreementVersion: string;
  /** Posé par l'administrateur : auto-parrainage, famille, commerce du partenaire (§10.8). */
  excludedReason: string | null;
}

export interface ConfirmedPayment {
  id: Id;
  businessId: Id;
  /** Instant de confirmation côté serveur (webhook FedaPay vérifié), pas une redirection. */
  confirmedAt: IsoDateTime;
  /** Montant encaissé par GoBilan (FCFA). */
  amount: number;
}

export type CommissionSkipReason =
  | 'excluded'
  | 'window_expired'
  | 'cap_reached'
  | 'chain_broken'
  | 'no_partner';

export interface CommissionLine {
  /** Clé d'idempotence : `${paymentId}:${role}` — rejouer le même paiement ne double rien. */
  key: string;
  paymentId: Id;
  referralId: Id;
  partnerId: Id;
  role: PartnerRole;
  /** 1 = premier paiement, 2..12 = renouvellements. */
  paymentIndex: number;
  /** Montant brut en FCFA, toujours positif ici (les annulations sont des lignes négatives). */
  amount: number;
  confirmedAt: IsoDateTime;
}

export interface CommissionContext {
  /** Nombre de paiements DÉJÀ commissionnés pour ce parrainage, hors paiement courant. */
  priorCommissionedPayments: number;
  /** Date du premier paiement commissionné, `null` si aucun. */
  firstPaymentAt: IsoDateTime | null;
  /**
   * Vrai si, au moment de ce paiement, l'abonnement était encore actif ou en grâce — c.-à-d.
   * si le client « renouvelle ». Un retour après blocage rompt la chaîne (HYPOTHÈSE D-004 :
   * le cahier dit « tant que le client renouvelle » sans traiter la reprise après coupure).
   */
  renewedWhileEntitled: boolean;
}

export interface CommissionResult {
  lines: CommissionLine[];
  skipped: CommissionSkipReason | null;
}

export function addMonthsUtc(iso: IsoDateTime, months: number): number {
  const d = new Date(iso);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return target.getTime();
}

/**
 * Commissions dues pour UN paiement confirmé d'une personne parrainée.
 * - Agent : ligne agent ; ligne manager en plus si l'agent a un manager (§10.5).
 * - Influenceur : une seule ligne.
 * Aucune commission sur essai, paiement annulé/remboursé/contesté (le serveur n'appelle cette
 * fonction que pour un paiement confirmé et ajoute une annulation si besoin) ni exclusion.
 */
export function computeCommissions(referral: Referral, payment: ConfirmedPayment, ctx: CommissionContext): CommissionResult {
  if (referral.excludedReason !== null) return { lines: [], skipped: 'excluded' };

  const confirmed = Date.parse(payment.confirmedAt);
  const index = ctx.priorCommissionedPayments + 1;

  if (index === 1) {
    if (confirmed - Date.parse(referral.registeredAt) > REFERRAL_WINDOW_DAYS * DAY_MS) {
      return { lines: [], skipped: 'window_expired' };
    }
  } else {
    if (index > MAX_COMMISSIONED_PAYMENTS) return { lines: [], skipped: 'cap_reached' };
    if (ctx.firstPaymentAt && confirmed > addMonthsUtc(ctx.firstPaymentAt, COMMISSION_DURATION_MONTHS)) {
      return { lines: [], skipped: 'cap_reached' };
    }
    if (!ctx.renewedWhileEntitled) return { lines: [], skipped: 'chain_broken' };
  }

  const roles: PartnerRole[] = referral.partnerRole === 'agent' ? ['agent', 'manager'] : ['influencer'];
  const lines: CommissionLine[] = [];
  for (const role of roles) {
    const partnerId = role === 'manager' ? referral.managerId : referral.partnerId;
    if (!partnerId) continue;
    const card = referral.rates[role];
    lines.push({
      key: `${payment.id}:${role}`,
      paymentId: payment.id,
      referralId: referral.id,
      partnerId,
      role,
      paymentIndex: index,
      amount: index === 1 ? card.first : card.renewal,
      confirmedAt: payment.confirmedAt,
    });
  }
  return lines.length === 0 ? { lines, skipped: 'no_partner' } : { lines, skipped: null };
}

export interface LedgerEntry {
  /** Clé d'idempotence unique dans le journal. */
  key: string;
  partnerId: Id;
  role: PartnerRole;
  referralId: Id;
  /** Positif = commission, négatif = annulation (remboursement, contestation). */
  amount: number;
  /** Date de versement prévue (§10.9). */
  payoutDate: string;
  confirmedAt: IsoDateTime;
  reverses: string | null;
}

/** Ligne d'annulation d'une commission : le journal n'est jamais modifié ni supprimé (§13.4). */
export function reversalOf(entry: LedgerEntry, reason: string, confirmedAt: IsoDateTime, payoutDate: string): LedgerEntry {
  return {
    key: `${entry.key}:reversal:${reason}`,
    partnerId: entry.partnerId,
    role: entry.role,
    referralId: entry.referralId,
    amount: -entry.amount,
    payoutDate,
    confirmedAt,
    reverses: entry.key,
  };
}

/** Statut affiché à l'agent (§10.6) : « Payé », « En essai », « Expiré ». */
export function referralStatus(referral: Pick<Referral, 'registeredAt'>, hasPaid: boolean, now: number): ReferralStatus {
  if (hasPaid) return 'paid';
  return now - Date.parse(referral.registeredAt) > REFERRAL_WINDOW_DAYS * DAY_MS ? 'expired' : 'trial';
}

/** Jours restants avant expiration du parrainage (0 si échu ou déjà payé). */
export function referralDaysLeft(referral: Pick<Referral, 'registeredAt'>, hasPaid: boolean, now: number): number {
  if (hasPaid) return 0;
  const end = Date.parse(referral.registeredAt) + REFERRAL_WINDOW_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((end - now) / DAY_MS));
}

/** Mois en cours de rémunération (1 à 12) pour le tableau de bord influenceur (§10.7). */
export function commissionMonth(paymentIndex: number): number {
  return Math.min(Math.max(paymentIndex, 1), MAX_COMMISSIONED_PAYMENTS);
}

/** Code promo agent : [PRÉNOM][CODE PAYS], ex. KOFFI225 (§10.2). L'unicité est garantie en base. */
export function agentPromoCode(firstName: string, dialCode: string): string {
  const base = firstName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  return `${base}${dialCode.replace('+', '')}`;
}

/**
 * Indice d'auto-parrainage : le numéro de versement du partenaire est identique à celui du
 * propriétaire du business parrainé. Heuristique d'aide à la décision pour l'administrateur,
 * jamais une exclusion automatique (D-008).
 */
export function isSelfReferralSuspect(partnerPayoutPhone: string | null, businessOwnerPhone: string): boolean {
  return partnerPayoutPhone !== null && partnerPayoutPhone === businessOwnerPhone;
}
