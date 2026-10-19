import { salesFromQuantities, sumLines } from '@/domain/reports';
import type { Id, ReportAmount, ReportContent } from '@/domain/types';

/** État du formulaire de bilan : tout est saisi en texte, converti à l'envoi. */
export interface DraftLine {
  id: string;
  label: string;
  /** Chiffres uniquement. */
  amount: string;
}

export interface DraftAmount {
  total: string;
  detailOpen: boolean;
  lines: DraftLine[];
}

export interface Draft {
  revenue: DraftAmount;
  expenses: DraftAmount;
  cashIn: DraftAmount;
  quantities: Record<Id, number>;
  note: string;
  openingCash: string;
}

export type AmountKey = 'revenue' | 'expenses' | 'cashIn';

let lineCounter = 0;
export function newLine(): DraftLine {
  lineCounter += 1;
  return { id: `draft-line-${lineCounter}`, label: '', amount: '' };
}

const emptyAmount = (): DraftAmount => ({ total: '', detailOpen: false, lines: [] });

export function emptyDraft(): Draft {
  return { revenue: emptyAmount(), expenses: emptyAmount(), cashIn: emptyAmount(), quantities: {}, note: '', openingCash: '' };
}

function amountFromReport(a: ReportAmount): DraftAmount {
  return {
    total: a.lines.length > 0 || a.total === 0 ? '' : String(a.total),
    detailOpen: a.lines.length > 0,
    lines: a.lines.map((l) => ({ id: l.id, label: l.label, amount: String(l.amount) })),
  };
}

export function draftFromContent(content: ReportContent): Draft {
  return {
    revenue: amountFromReport(content.revenue),
    expenses: amountFromReport(content.expenses),
    cashIn: amountFromReport(content.cashIn),
    quantities: Object.fromEntries(content.stockSales.map((s) => [s.itemId, s.quantity])),
    note: content.note,
    openingCash: '',
  };
}

function amountToReport(a: DraftAmount): ReportAmount {
  // Les lignes entièrement vides sont ignorées ; les autres sont validées par `validateDraft`.
  const lines = a.detailOpen
    ? a.lines
        .filter((l) => l.label.trim() !== '' || l.amount !== '')
        .map((l) => ({ id: l.id, label: l.label.trim(), amount: Number(l.amount || '0') }))
    : [];
  return lines.length > 0 ? { total: sumLines(lines), lines } : { total: Number(a.total || '0'), lines: [] };
}

export function draftToContent(d: Draft): ReportContent {
  return {
    revenue: amountToReport(d.revenue),
    expenses: amountToReport(d.expenses),
    cashIn: amountToReport(d.cashIn),
    stockSales: salesFromQuantities(d.quantities),
    note: d.note,
  };
}

export function draftOpeningCash(d: Draft): number | null {
  return d.openingCash === '' ? null : Number(d.openingCash);
}
