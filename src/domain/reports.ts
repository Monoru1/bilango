import { addDays, diffDays, eachDay, type DateRange } from './dates';
import { percentChange } from './money';
import type {
  Business,
  DayKey,
  Id,
  Report,
  ReportAmount,
  ReportContent,
  ReportLine,
  ReportVersion,
  StockItem,
  StockSale,
} from './types';

export const EMPTY_AMOUNT: ReportAmount = { total: 0, lines: [] };

export function emptyContent(): ReportContent {
  return {
    revenue: { total: 0, lines: [] },
    expenses: { total: 0, lines: [] },
    cashIn: { total: 0, lines: [] },
    stockSales: [],
    note: '',
  };
}

export function sumLines(lines: ReportLine[]): number {
  return lines.reduce((acc, l) => acc + l.amount, 0);
}

/** Si le détail existe, il fait foi : le total est la somme des lignes (cahier §5.1). */
export function normalizeAmount(amount: ReportAmount): ReportAmount {
  return amount.lines.length > 0 ? { total: sumLines(amount.lines), lines: amount.lines } : amount;
}

export function currentVersion(report: Report): ReportVersion {
  return report.versions[report.versions.length - 1];
}

export function originalVersion(report: Report): ReportVersion {
  return report.versions[0];
}

export function isEdited(report: Report): boolean {
  return report.versions.length > 1;
}

export function lastSavedAt(report: Report): string {
  return currentVersion(report).savedAt;
}

// --- Validation du formulaire -------------------------------------------------

export interface DraftErrors {
  revenue?: string;
  expenses?: string;
  cashIn?: string;
  openingCash?: string;
  stock?: string;
  note?: string;
}

export interface DraftValidation {
  ok: boolean;
  errors: DraftErrors;
}

const NOTE_MAX = 500;

function validateAmount(amount: ReportAmount): string | undefined {
  if (!Number.isSafeInteger(amount.total) || amount.total < 0) return 'Montant invalide.';
  for (const line of amount.lines) {
    if (line.label.trim() === '') return 'Chaque ligne détaillée doit avoir un nom.';
    if (!Number.isSafeInteger(line.amount) || line.amount <= 0) return 'Chaque ligne doit avoir un montant supérieur à 0.';
  }
  if (!Number.isSafeInteger(normalizeAmount(amount).total)) return 'Montant invalide.';
  return undefined;
}

/**
 * Valide un bilan avant envoi. `remainingStock` donne le restant disponible par article :
 * on ne peut pas déclarer vendre plus que le stock restant. `openingCashRequired`
 * s'applique au tout premier bilan du business (caisse de départ à déclarer une fois).
 */
export function validateDraft(
  content: ReportContent,
  options: {
    openingCashRequired?: boolean;
    openingCash?: number | null;
    remainingStock?: Record<Id, number>;
  } = {},
): DraftValidation {
  const errors: DraftErrors = {};
  const revenue = validateAmount(content.revenue);
  if (revenue) errors.revenue = revenue;
  const expenses = validateAmount(content.expenses);
  if (expenses) errors.expenses = expenses;
  const cashIn = validateAmount(content.cashIn);
  if (cashIn) errors.cashIn = cashIn;

  if (options.openingCashRequired) {
    const v = options.openingCash;
    if (v === null || v === undefined || Number.isNaN(v)) {
      errors.openingCash = 'Indiquez le montant compté dans la caisse.';
    } else if (!Number.isSafeInteger(v) || v < 0) {
      errors.openingCash = 'Montant invalide.';
    }
  }

  {
    const seen = new Set<Id>();
    for (const sale of content.stockSales) {
      if (!Number.isInteger(sale.quantity) || sale.quantity < 0) {
        errors.stock = 'Quantité invalide.';
        break;
      }
      if (seen.has(sale.itemId)) {
        errors.stock = 'Un article ne peut apparaître qu’une fois.';
        break;
      }
      seen.add(sale.itemId);
      const remaining = options.remainingStock?.[sale.itemId];
      if (options.remainingStock && remaining === undefined) {
        errors.stock = 'Article de stock introuvable pour ce business.';
        break;
      }
      if (remaining !== undefined && sale.quantity > remaining) {
        errors.stock = 'Une quantité vendue dépasse le stock restant.';
        break;
      }
    }
  }

  if (content.note.length > NOTE_MAX) errors.note = `La note est limitée à ${NOTE_MAX} caractères.`;

  return { ok: Object.keys(errors).length === 0, errors };
}

/** Retire les ventes à 0 et normalise les montants avant d'enregistrer. */
export function finalizeContent(content: ReportContent): ReportContent {
  return {
    revenue: normalizeAmount(content.revenue),
    expenses: normalizeAmount(content.expenses),
    cashIn: normalizeAmount(content.cashIn),
    stockSales: content.stockSales.filter((s) => s.quantity > 0),
    note: content.note.trim(),
  };
}

// --- Agrégats ----------------------------------------------------------------

export interface DayTotals {
  day: DayKey;
  revenue: number;
  expenses: number;
  cashIn: number;
  reportCount: number;
}

export function reportsOfDay(reports: Report[], businessId: Id, day: DayKey): Report[] {
  return reports
    .filter((r) => r.businessId === businessId && r.day === day)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

export function totalsOfDay(reports: Report[], businessId: Id, day: DayKey): DayTotals {
  const list = reportsOfDay(reports, businessId, day);
  return list.reduce<DayTotals>(
    (acc, r) => {
      const c = currentVersion(r).content;
      acc.revenue += c.revenue.total;
      acc.expenses += c.expenses.total;
      acc.cashIn += c.cashIn.total;
      acc.reportCount += 1;
      return acc;
    },
    { day, revenue: 0, expenses: 0, cashIn: 0, reportCount: 0 },
  );
}

/** Totaux sur `days` jours se terminant à `endDay` (inclus). */
export function totalsOfPeriod(reports: Report[], businessId: Id, endDay: DayKey, days: number): DayTotals {
  return totalsInRange(reports, businessId, { from: addDays(endDay, 1 - days), to: endDay });
}

/** Bornes inclusives, versions courantes, coût proportionnel aux bilans et non aux jours. */
export function totalsInRange(reports: Report[], businessId: Id, range: DateRange): DayTotals {
  return reports.reduce<DayTotals>((acc, r) => {
    if (r.businessId === businessId && r.day >= range.from && r.day <= range.to) {
      const c = currentVersion(r).content;
      acc.revenue += c.revenue.total;
      acc.expenses += c.expenses.total;
      acc.cashIn += c.cashIn.total;
      acc.reportCount++;
    }
    return acc;
  }, { day: range.to, revenue: 0, expenses: 0, cashIn: 0, reportCount: 0 });
}

/** Seuls les jours ayant un bilan sont des points mesurés ; les absences ne valent pas zéro. */
export function revenueTrend(reports: Report[], businessId: Id, range: DateRange): DayTotals[] {
  const days = [...new Set(reports.filter(r => r.businessId === businessId && r.day >= range.from && r.day <= range.to).map(r => r.day))].sort();
  return days.map(day => totalsOfDay(reports, businessId, day));
}

export function periodComparison(reports: Report[], businessId: Id, range: DateRange): number | null {
  const length = diffDays(range.to, range.from) + 1;
  const previous = { from: addDays(range.from, -length), to: addDays(range.from, -1) };
  const current = totalsInRange(reports, businessId, range);
  const before = totalsInRange(reports, businessId, previous);
  return current.reportCount && before.reportCount ? percentChange(current.revenue, before.revenue) : null;
}

export function latestReportDay(reports: Report[], businessId: Id, upTo: DayKey): DayKey | null {
  let best: DayKey | null = null;
  for (const r of reports) {
    if (r.businessId === businessId && r.day <= upTo && (best === null || r.day > best)) best = r.day;
  }
  return best;
}

export interface Headline {
  /** `today` : bilan du jour présent ; `last` : dernier bilan disponible ; `none` : aucun bilan. */
  kind: 'today' | 'last' | 'none';
  day: DayKey | null;
  revenue: number;
  /** Badge "En attente du bilan" : la journée est en cours et aucun bilan n'est arrivé. */
  awaitingToday: boolean;
  previousDay: DayKey | null;
  previousRevenue: number | null;
  /** Évolution en % par rapport à la veille du jour affiché, `null` si non comparable. */
  deltaPercent: number | null;
}

/**
 * Chiffre principal du dashboard (cahier §6.1) : CA du jour s'il existe, sinon le dernier
 * bilan disponible avec sa date. Jamais un faux zéro.
 */
export function buildHeadline(reports: Report[], businessId: Id, today: DayKey): Headline {
  const todayTotals = totalsOfDay(reports, businessId, today);
  if (todayTotals.reportCount > 0) {
    return withComparison(reports, businessId, 'today', today, todayTotals.revenue, false);
  }
  const last = latestReportDay(reports, businessId, today);
  if (last === null) {
    return {
      kind: 'none',
      day: null,
      revenue: 0,
      awaitingToday: true,
      previousDay: null,
      previousRevenue: null,
      deltaPercent: null,
    };
  }
  return withComparison(reports, businessId, 'last', last, totalsOfDay(reports, businessId, last).revenue, true);
}

function withComparison(
  reports: Report[],
  businessId: Id,
  kind: 'today' | 'last',
  day: DayKey,
  revenue: number,
  awaiting: boolean,
): Headline {
  const previousDay = addDays(day, -1);
  const prev = totalsOfDay(reports, businessId, previousDay);
  const hasPrev = prev.reportCount > 0;
  return {
    kind,
    day,
    revenue,
    awaitingToday: awaiting,
    previousDay: hasPrev ? previousDay : null,
    previousRevenue: hasPrev ? prev.revenue : null,
    deltaPercent: hasPrev ? percentChange(revenue, prev.revenue) : null,
  };
}

// --- Caisse théorique ----------------------------------------------------------

export interface CashDay {
  day: DayKey;
  /** Caisse de la veille (ou caisse de départ pour le premier jour). */
  opening: number;
  revenue: number;
  cashIn: number;
  expenses: number;
  closing: number;
}

/**
 * Caisse du jour = Caisse de la veille + CA + Ajouts à la caisse − Dépenses (cahier §5.3).
 * La caisse est toujours recalculée depuis les versions courantes des bilans : une
 * modification se répercute donc en cascade sur tous les jours suivants, sans état à
 * synchroniser. Retourne `[]` tant que la caisse de départ n'est pas déclarée.
 * Aucun écart ni alerte n'est calculé : l'app fournit la référence, pas un verdict.
 */
export function cashTimeline(
  business: Pick<Business, 'id' | 'openingCash'>,
  reports: Report[],
  toDay: DayKey,
): CashDay[] {
  const opening = business.openingCash;
  if (!opening || opening.day > toDay) return [];
  let running = opening.amount;
  return eachDay(opening.day, toDay).map((day) => {
    const t = totalsOfDay(reports, business.id, day);
    const row: CashDay = {
      day,
      opening: running,
      revenue: t.revenue,
      cashIn: t.cashIn,
      expenses: t.expenses,
      closing: running + t.revenue + t.cashIn - t.expenses,
    };
    running = row.closing;
    return row;
  });
}

/** Caisse théorique à la fin du jour donné, `null` si la caisse de départ est inconnue. */
export function theoreticalCash(
  business: Pick<Business, 'id' | 'openingCash'>,
  reports: Report[],
  day: DayKey,
): CashDay | null {
  if (!business.openingCash || business.openingCash.day > day) return null;
  const before = totalsInRange(reports, business.id, { from: business.openingCash.day, to: addDays(day, -1) });
  const today = totalsOfDay(reports, business.id, day);
  const opening = business.openingCash.amount + before.revenue + before.cashIn - before.expenses;
  return { day, revenue: today.revenue, expenses: today.expenses, cashIn: today.cashIn, opening, closing: opening + today.revenue + today.cashIn - today.expenses };
}

// --- Stock ---------------------------------------------------------------------

export function soldQuantities(reports: Report[], businessId: Id): Record<Id, number> {
  const sold: Record<Id, number> = {};
  for (const r of reports) {
    if (r.businessId !== businessId) continue;
    for (const s of currentVersion(r).content.stockSales) {
      sold[s.itemId] = (sold[s.itemId] ?? 0) + s.quantity;
    }
  }
  return sold;
}

export interface StockLevel {
  item: StockItem;
  sold: number;
  remaining: number;
}

export function stockLevels(items: StockItem[], reports: Report[], businessId: Id): StockLevel[] {
  const sold = soldQuantities(reports, businessId);
  return items
    .filter((i) => i.businessId === businessId)
    .map((item) => ({ item, sold: sold[item.id] ?? 0, remaining: item.initialQuantity - (sold[item.id] ?? 0) }));
}

/** Restant disponible par article, en excluant un bilan (pour valider sa propre modification). */
export function remainingStockExcluding(
  items: StockItem[],
  reports: Report[],
  businessId: Id,
  excludeReportId?: Id,
): Record<Id, number> {
  const rest = excludeReportId ? reports.filter((r) => r.id !== excludeReportId) : reports;
  const out: Record<Id, number> = {};
  for (const l of stockLevels(items, rest, businessId)) out[l.item.id] = l.remaining;
  return out;
}

export function salesFromQuantities(quantities: Record<Id, number>): StockSale[] {
  return Object.entries(quantities)
    .filter(([, q]) => q > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity }));
}

/** Nombre de jours sans bilan entre deux jours (utile pour signaler les oublis). */
export function missingDays(reports: Report[], businessId: Id, from: DayKey, to: DayKey): DayKey[] {
  if (diffDays(to, from) < 0) return [];
  return eachDay(from, to).filter((d) => totalsOfDay(reports, businessId, d).reportCount === 0);
}
