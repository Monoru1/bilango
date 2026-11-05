import { describe, expect, it } from 'vitest';
import { COUNTRIES, COUNTRY_CODES } from '../countries';
import { CLOSING_TIME_PRESETS, firstNameOf, isClockTime, ownerReportNotice } from '../notifications';

/** Décalage réel (minutes) d'un fuseau IANA à un instant donné, d'après l'ICU de Node. */
function ianaOffsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((local - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

describe('heure de fermeture et fuseaux (v1.2 §2)', () => {
  it('propose 18h00, 20h00 et 21h30 et accepte une heure libre valide', () => {
    expect([...CLOSING_TIME_PRESETS]).toEqual(['18:00', '20:00', '21:30']);
    expect(isClockTime('07:45')).toBe(true);
    for (const bad of ['24:00', '7:45', '21h30', '', '21:60']) expect(isClockTime(bad)).toBe(false);
  });

  it("utilise le vrai fuseau de chaque pays, sans heure d'été (Bénin UTC+1, Côte d'Ivoire et Togo UTC+0)", () => {
    expect(COUNTRIES.BJ.timeZone).toBe('Africa/Porto-Novo');
    expect(COUNTRIES.CI.timeZone).toBe('Africa/Abidjan');
    expect(COUNTRIES.TG.timeZone).toBe('Africa/Lome');
    const instants = ['2026-01-15T12:00:00Z', '2026-03-29T12:00:00Z', '2026-07-01T12:00:00Z', '2026-10-25T12:00:00Z', '2026-11-15T20:30:00Z'];
    for (const code of COUNTRY_CODES) {
      for (const at of instants) expect(ianaOffsetMinutes(COUNTRIES[code].timeZone, new Date(at)), `${code} ${at}`).toBe(COUNTRIES[code].utcOffsetMinutes);
    }
  });
});

describe('notification interne au propriétaire (v1.2 §4)', () => {
  it('un seul employé : bilan « disponible » ; plusieurs : notification individuelle', () => {
    expect(ownerReportNotice(0)).toBe('available');
    expect(ownerReportNotice(1)).toBe('available');
    expect(ownerReportNotice(2)).toBe('individual');
    expect(ownerReportNotice(3)).toBe('individual');
  });

  it('extrait le prénom du nom saisi', () => {
    expect(firstNameOf('  Awa   Koné ')).toBe('Awa');
    expect(firstNameOf('')).toBe('');
    expect(firstNameOf('x'.repeat(60))).toHaveLength(40);
  });
});
