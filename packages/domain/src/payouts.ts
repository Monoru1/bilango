/**
 * Versements manuels aux partenaires (cahier §10.9, §10.10) : les 1er et 15 de chaque mois,
 * jours fériés et week-ends compris, seuil de 2 000 FCFA cumulés, frais déduits du versement.
 * Le calcul ne déclenche jamais d'argent : l'administrateur paie hors application puis valide.
 */
import { DEFAULT_UTC_OFFSET_MINUTES } from './countries';
import { addDays, toDayKey } from './dates';
import type { LedgerEntry } from './commissions';
import type { DayKey, Id, IsoDateTime } from './types';

export const PAYOUT_THRESHOLD_FCFA = 2000;

/**
 * Date de versement d'un paiement client confirmé : du 1er au 14 -> le 15 du même mois ;
 * du 15 au dernier jour -> le 1er du mois suivant. Le jour du mois est lu dans le fuseau de
 * Cotonou (siège de Novadis Digital, D-010).
 */
export function payoutDateFor(confirmedAt: IsoDateTime, offsetMinutes: number = DEFAULT_UTC_OFFSET_MINUTES): DayKey {
  const day = toDayKey(confirmedAt, offsetMinutes);
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  if (d < 15) return `${y}-${String(m).padStart(2, '0')}-15`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

/** Prochaine date de versement (1er ou 15) à partir d'un jour donné, ce jour compris. */
export function nextPayoutDate(from: DayKey): DayKey {
  for (let i = 0; i < 32; i++) {
    const d = addDays(from, i);
    if (d.endsWith('-01') || d.endsWith('-15')) return d;
  }
  return from;
}

export interface PartnerBalance {
  partnerId: Id;
  /** Somme des lignes dues à la date du cycle (commissions - annulations), brut. */
  gross: number;
  /** Vrai si `gross` atteint le seuil : le versement peut être effectué. */
  payable: boolean;
  /** Solde reporté au cycle suivant (seuil non atteint ou solde négatif). */
  carriedOver: number;
  entryKeys: string[];
}

/**
 * Soldes à verser à une date de cycle. Les lignes non encore versées dont la date prévue est
 * échue (ou antérieure) sont cumulées : le report sous le seuil et la déduction des paiements
 * remboursés après versement sont ainsi automatiques (§10.9). Un solde négatif n'est jamais
 * payable : il est déduit des versements suivants.
 */
export function computePayoutBalances(
  entries: readonly LedgerEntry[],
  paidKeys: ReadonlySet<string>,
  cycleDate: DayKey,
): PartnerBalance[] {
  const byPartner = new Map<Id, LedgerEntry[]>();
  for (const e of entries) {
    if (paidKeys.has(e.key) || e.payoutDate > cycleDate) continue;
    const list = byPartner.get(e.partnerId) ?? [];
    list.push(e);
    byPartner.set(e.partnerId, list);
  }
  return [...byPartner.entries()]
    .map(([partnerId, list]) => {
      const gross = list.reduce((acc, e) => acc + e.amount, 0);
      const payable = gross >= PAYOUT_THRESHOLD_FCFA;
      return { partnerId, gross, payable, carriedOver: payable ? 0 : gross, entryKeys: list.map((e) => e.key) };
    })
    .sort((a, b) => a.partnerId.localeCompare(b.partnerId));
}

export interface PayoutLine {
  gross: number;
  fees: number;
  net: number;
}

/** Montant net = brut − frais de transaction de l'opérateur (§10.10). Frais saisis à la validation. */
export function netOfFees(gross: number, fees: number): PayoutLine {
  if (!Number.isSafeInteger(gross) || !Number.isSafeInteger(fees) || gross < 0 || fees < 0) {
    throw new RangeError('Montants invalides : entiers FCFA positifs attendus.');
  }
  if (fees > gross) throw new RangeError('Les frais ne peuvent pas dépasser le montant brut.');
  return { gross, fees, net: gross - fees };
}
