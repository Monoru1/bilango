import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../dates';
import {
  checkOtpState,
  evaluateOtpIssue,
  INITIAL_PIN_STATE,
  isPinLocked,
  isValidPartnerPassword,
  isValidPinFormat,
  pinLockDurationMs,
  pinRetryAfterMs,
  registerPinFailure,
  registerPinSuccess,
  type PinState,
} from '../security';

const T = Date.parse('2026-10-09T10:00:00.000Z');
const MIN = 60_000;

function failTimes(state: PinState, n: number, now: number): PinState {
  let s = state;
  for (let i = 0; i < n; i++) s = registerPinFailure(s, now);
  return s;
}

describe('PIN : blocage progressif (§4.2, §13.2)', () => {
  it('ne bloque pas avant la 4e erreur', () => {
    const s = failTimes(INITIAL_PIN_STATE, 3, T);
    expect(isPinLocked(s, T)).toBe(false);
    expect(s.failedAttempts).toBe(3);
  });

  it('bloque 5 minutes à la 4e erreur', () => {
    const s = failTimes(INITIAL_PIN_STATE, 4, T);
    expect(isPinLocked(s, T + 4 * MIN)).toBe(true);
    expect(isPinLocked(s, T + 5 * MIN)).toBe(false);
    expect(pinRetryAfterMs(s, T + MIN)).toBe(4 * MIN);
  });

  it('double le blocage à chaque nouvelle série : 5, 10, 20, 40 minutes', () => {
    expect([0, 1, 2, 3].map((n) => pinLockDurationMs(n) / MIN)).toEqual([5, 10, 20, 40]);
    let s = failTimes(INITIAL_PIN_STATE, 4, T);
    const t2 = T + 6 * MIN;
    s = failTimes(s, 4, t2);
    expect(s.lockedUntil).toBe(t2 + 10 * MIN);
    const t3 = t2 + 11 * MIN;
    s = failTimes(s, 4, t3);
    expect(s.lockedUntil).toBe(t3 + 20 * MIN);
  });

  it('plafonne le blocage à 24 h (hypothèse D-006)', () => {
    expect(pinLockDurationMs(30)).toBe(DAY_MS);
  });

  it("n'escalade pas pendant un blocage : les essais bloqués sont ignorés", () => {
    const locked = failTimes(INITIAL_PIN_STATE, 4, T);
    expect(registerPinFailure(locked, T + MIN)).toEqual(locked);
  });

  it('un succès remet la série et l\'escalade à zéro', () => {
    expect(registerPinSuccess()).toEqual(INITIAL_PIN_STATE);
  });

  it('valide le format à 4 chiffres uniquement', () => {
    expect(isValidPinFormat('0420')).toBe(true);
    for (const bad of ['123', '12345', 'abcd', '12 4', '']) expect(isValidPinFormat(bad)).toBe(false);
  });
});

describe('OTP : limites (§4.4)', () => {
  it('autorise 2 codes par fenêtre de 24 h puis bloque', () => {
    expect(evaluateOtpIssue([], T).allowed).toBe(true);
    expect(evaluateOtpIssue([T - 1000], T).allowed).toBe(true);
    const third = evaluateOtpIssue([T - 2 * MIN, T - MIN], T);
    expect(third.allowed).toBe(false);
    expect(third.retryAt).toBe(T - 2 * MIN + DAY_MS);
  });

  it('libère un créneau quand le plus ancien code sort de la fenêtre', () => {
    expect(evaluateOtpIssue([T - DAY_MS - 1, T - MIN], T).allowed).toBe(true);
  });

  it('applique usage unique, expiration à 10 min et 4 saisies', () => {
    expect(checkOtpState({ issuedAt: T, attempts: 0, consumed: false }, T + 9 * MIN)).toBe('ok');
    expect(checkOtpState({ issuedAt: T, attempts: 0, consumed: false }, T + 10 * MIN)).toBe('expired');
    expect(checkOtpState({ issuedAt: T, attempts: 4, consumed: false }, T + MIN)).toBe('too_many_attempts');
    expect(checkOtpState({ issuedAt: T, attempts: 1, consumed: true }, T + MIN)).toBe('already_used');
  });
});

describe('mot de passe partenaire (§13.3)', () => {
  it('exige 8 caractères minimum', () => {
    expect(isValidPartnerPassword('1234567')).toBe(false);
    expect(isValidPartnerPassword('12345678')).toBe(true);
  });
});
