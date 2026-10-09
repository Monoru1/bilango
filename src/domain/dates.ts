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
