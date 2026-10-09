import type { DayKey, IsoDateTime } from './types';

/**
 * Les jours métier sont ceux de Cotonou (UTC+1, sans heure d'été) quel que soit le fuseau
 * du téléphone : le calcul est donc déterministe et testable.
 */
const BENIN_OFFSET_MS = 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function toMs(value: Date | number | string): number {
  return value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
}

export function toDayKey(value: Date | number | string): DayKey {
  return new Date(toMs(value) + BENIN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Prochain minuit à Cotonou, en millisecondes UTC. */
export function nextBusinessDayAt(now: number): number {
  return (Math.floor((now + BENIN_OFFSET_MS) / DAY_MS) + 1) * DAY_MS - BENIN_OFFSET_MS;
}

function dayKeyToUtcMs(day: DayKey): number {
  return Date.parse(`${day}T00:00:00.000Z`);
}

export function addDays(day: DayKey, delta: number): DayKey {
  return new Date(dayKeyToUtcMs(day) + delta * DAY_MS).toISOString().slice(0, 10);
}

export function diffDays(later: DayKey, earlier: DayKey): number {
  return Math.round((dayKeyToUtcMs(later) - dayKeyToUtcMs(earlier)) / DAY_MS);
}

/** Liste des jours de `from` à `to` inclus. */
export function eachDay(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Instant UTC correspondant à "HH:mm" à Cotonou le jour donné. */
export function beninInstant(day: DayKey, hhmm: string): IsoDateTime {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(dayKeyToUtcMs(day) + (h * 60 + m) * 60_000 - BENIN_OFFSET_MS).toISOString();
}

/** "jeudi 9 octobre" */
export function formatDayLong(day: DayKey): string {
  const d = new Date(dayKeyToUtcMs(day));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "9 oct." */
export function formatDayShort(day: DayKey): string {
  const d = new Date(dayKeyToUtcMs(day));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 4)}.`;
}

/** "9 octobre 2026" */
export function formatDayFull(day: DayKey): string {
  const d = new Date(dayKeyToUtcMs(day));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "14h05" (heure de Cotonou) */
export function formatTime(value: Date | number | string): string {
  const d = new Date(toMs(value) + BENIN_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}h${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** "9 oct. à 14h05" */
export function formatDateTime(value: Date | number | string): string {
  return `${formatDayShort(toDayKey(value))} à ${formatTime(value)}`;
}

/** Libellé relatif : "Aujourd'hui", "Hier" ou "jeudi 9 octobre". */
export function formatDayRelative(day: DayKey, today: DayKey): string {
  const delta = diffDays(today, day);
  if (delta === 0) return "Aujourd'hui";
  if (delta === 1) return 'Hier';
  return formatDayLong(day);
}

/** Date civile ISO stricte : rejette aussi les dates normalisées comme le 31 février. */
export function isDayKey(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day.slice(0, 4) === '0000') return false;
  const ms = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === day;
}

export interface DateRange { from: DayKey; to: DayKey }
export type DashboardPeriod = 1 | 7 | 30 | DateRange;

export function rangeError(range: DateRange, today: DayKey): string | undefined {
  if (!isDayKey(range.from) || !isDayKey(range.to)) return 'Choisissez deux dates valides.';
  if (range.to < range.from) return 'La fin ne peut pas précéder le début.';
  if (range.to > today) return 'Les dates futures ne sont pas disponibles.';
  return undefined;
}

export function periodRange(period: DashboardPeriod, today: DayKey): DateRange {
  return typeof period === 'number' ? { from: addDays(today, 1 - period), to: today } : period;
}

export function parseFrenchDay(value: string): DayKey | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const day = `${match[3]}-${match[2]}-${match[1]}`;
  return isDayKey(day) ? day : null;
}

export function frenchDay(day: DayKey): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

/** Grille de six semaines, lundi d'abord ; jamais d'énumération de la plage sélectionnée. */
export function calendarDays(month: DayKey): DayKey[] {
  const first = `${month.slice(0, 7)}-01`;
  const weekday = new Date(`${first}T00:00:00Z`).getUTCDay();
  const start = addDays(first, -((weekday + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
