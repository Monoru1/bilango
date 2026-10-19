import { capitalize, formatDayLong, formatTime, type DayKey, type Report } from '@gobilan/domain';

const MONTHS3 = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WD = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const WDLONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const parts = (day: DayKey) => {
  const d = new Date(`${day}T00:00:00.000Z`);
  return { wd: d.getUTCDay(), dd: d.getUTCDate(), m: d.getUTCMonth() };
};

/** « Vendredi 9 octobre » (listes). */
export const dayLong = (day: DayKey) => capitalize(formatDayLong(day));
/** « VENDREDI 9 OCT. » (carte sombre, annexe B.2). */
export const cardDate = (day: DayKey) => { const p = parts(day); return `${WDLONG[p.wd]} ${p.dd} ${MONTHS3[p.m]}`.toUpperCase(); };
/** « ven. 9 oct. » (comparaison à la veille, annexe B.1). */
export const shortDate = (day: DayKey) => { const p = parts(day); return `${WD[p.wd]} ${p.dd} ${MONTHS3[p.m]}`; };
/** « 19:42 » (heure locale du business). */
export const hhmm = (value: string | number | Date, offsetMinutes: number) => formatTime(value, offsetMinutes).replace('h', ':');
export const timeOf = (r: Pick<Report, 'submittedAt'>, offset: number) => hhmm(r.submittedAt, offset);
export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? full;
