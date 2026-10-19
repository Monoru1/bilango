import { DEFAULT_UTC_OFFSET_MINUTES } from './countries';
import type { DayKey, IsoDateTime } from './types';

/**
 * Jours métier : calculés dans le fuseau du PAYS DU BUSINESS (Bénin UTC+1, Côte d'Ivoire et
 * Togo UTC+0, sans heure d'été) et non dans celui du téléphone, pour rester déterministes
 * et testables. Le paramètre `offsetMinutes` vaut Cotonou par défaut (D-010).
 */
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
const MIN_MS = 60 * 1000;

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

export function toDayKey(value: Date | number | string, offsetMinutes: number = DEFAULT_UTC_OFFSET_MINUTES): DayKey {
  return new Date(toMs(value) + offsetMinutes * MIN_MS).toISOString().slice(0, 10);
}

/** Prochain minuit dans le fuseau donné, en millisecondes UTC. */
export function nextBusinessDayAt(now: number, offsetMinutes: number = DEFAULT_UTC_OFFSET_MINUTES): number {
  const off = offsetMinutes * MIN_MS;
  return (Math.floor((now + off) / DAY_MS) + 1) * DAY_MS - off;
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

/** Instant UTC correspondant à "HH:mm" le jour donné dans le fuseau donné. */
export function localInstant(day: DayKey, hhmm: string, offsetMinutes: number = DEFAULT_UTC_OFFSET_MINUTES): IsoDateTime {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return new Date(dayKeyToUtcMs(day) + (h * 60 + m - offsetMinutes) * MIN_MS).toISOString();
}

/** Alias historique (ancienne app) : heure de Cotonou. */
export function beninInstant(day: DayKey, hhmm: string): IsoDateTime {
  return localInstant(day, hhmm, 60);
}

/** "jeudi 9 octobre" */
export function formatDayLong(day: DayKey): string {
  const d = new Date(dayKeyToUtcMs(day));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "9 oct." */
export function formatDayShort(day: DayKey): string {
  const d = new Date(dayKeyToUtcMs(day));
  return `${d.getUTCDate()} ${(MONTHS[d.getUTCMonth()] ?? '').slice(0, 4)}.`;
}

/** "9 octobre 2026" */
export function formatDayFull(day: DayKey): string {
  const d = new Date(dayKeyToUtcMs(day));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "14h05" (heure locale du fuseau donné) */
export function formatTime(value: Date | number | string, offsetMinutes: number = DEFAULT_UTC_OFFSET_MINUTES): string {
  const d = new Date(toMs(value) + offsetMinutes * MIN_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}h${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** "9 oct. à 14h05" */
export function formatDateTime(value: Date | number | string, offsetMinutes: number = DEFAULT_UTC_OFFSET_MINUTES): string {
  return `${formatDayShort(toDayKey(value, offsetMinutes))} à ${formatTime(value, offsetMinutes)}`;
}

/** Libellé relatif : "Aujourd'hui", "Hier" ou "jeudi 9 octobre". */
export function formatDayRelative(day: DayKey, today: DayKey): string {
  const delta = diffDays(today, day);
  if (delta === 0) return "Aujourd'hui";
  if (delta === 1) return 'Hier';
  return formatDayLong(day);
}

/** Majuscule initiale : "Jeudi 8 octobre" (liste des bilans, annexe B.2). */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
