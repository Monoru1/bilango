/**
 * Politiques anti-abus pures (cahier §4.2, §4.4, §10.1, §13). Elles décrivent la règle ;
 * c'est le SERVEUR qui les applique et persiste l'état. Une restriction d'interface n'est
 * jamais une protection.
 */
import { DAY_MS } from './dates';

// --- PIN utilisateur ---------------------------------------------------------------

export const PIN_LENGTH = 4;
export const PIN_MAX_ATTEMPTS = 4;
export const PIN_LOCK_BASE_MS = 5 * 60 * 1000;
/**
 * Plafond du blocage : le cahier dit « doublé à chaque nouvelle série » sans borne.
 * Un doublement illimité deviendrait un déni de service contre le titulaire légitime ;
 * on plafonne à 24 h (HYPOTHÈSE D-006, à faire valider par le client).
 */
export const PIN_LOCK_MAX_MS = DAY_MS;

export interface PinState {
  failedAttempts: number;
  /** Nombre de séries d'erreurs déjà sanctionnées (exposant du doublement). */
  lockCount: number;
  /** Instant UTC (ms) de fin de blocage, `null` si non bloqué. */
  lockedUntil: number | null;
}

export const INITIAL_PIN_STATE: PinState = { failedAttempts: 0, lockCount: 0, lockedUntil: null };

/** 5 min, 10 min, 20 min, 40 min… plafonné à 24 h. */
export function pinLockDurationMs(lockCount: number): number {
  return Math.min(PIN_LOCK_BASE_MS * 2 ** lockCount, PIN_LOCK_MAX_MS);
}

export function isPinLocked(state: PinState, now: number): boolean {
  return state.lockedUntil !== null && now < state.lockedUntil;
}

export function pinRetryAfterMs(state: PinState, now: number): number {
  return isPinLocked(state, now) ? (state.lockedUntil as number) - now : 0;
}

/** À appeler à chaque PIN erroné. Pendant un blocage, l'état n'évolue pas (pas d'escalade gratuite). */
export function registerPinFailure(state: PinState, now: number): PinState {
  if (isPinLocked(state, now)) return state;
  const failed = state.failedAttempts + 1;
  if (failed >= PIN_MAX_ATTEMPTS) {
    return { failedAttempts: 0, lockCount: state.lockCount + 1, lockedUntil: now + pinLockDurationMs(state.lockCount) };
  }
  return { ...state, failedAttempts: failed };
}

/** Succès : réinitialise la série et l'escalade (HYPOTHÈSE D-006). */
export function registerPinSuccess(): PinState {
  return { ...INITIAL_PIN_STATE };
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

// --- Codes OTP (WhatsApp utilisateurs, e-mail partenaires et admin) -------------------

export const OTP_USER_LENGTH = 4;
export const OTP_PARTNER_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 4;
export const OTP_MAX_ISSUES_PER_24H = 2;

export interface OtpIssueDecision {
  allowed: boolean;
  /** Instant UTC (ms) à partir duquel un nouveau code peut être demandé, `null` si autorisé. */
  retryAt: number | null;
}

/**
 * Deux codes maximum par fenêtre glissante de 24 h pour un même numéro / e-mail (§4.4, §10.1).
 * Au-delà : envoi bloqué ; le blocage se lève 24 h après l'émission du plus ancien des deux
 * codes (interprétation D-005 — le cahier ne précise pas si la fenêtre est glissante).
 */
export function evaluateOtpIssue(issuedAt: readonly number[], now: number): OtpIssueDecision {
  const recent = issuedAt.filter((t) => now - t < DAY_MS).sort((a, b) => a - b);
  if (recent.length < OTP_MAX_ISSUES_PER_24H) return { allowed: true, retryAt: null };
  const oldest = recent[recent.length - OTP_MAX_ISSUES_PER_24H] as number;
  return { allowed: false, retryAt: oldest + DAY_MS };
}

export interface OtpCheckInput {
  issuedAt: number;
  attempts: number;
  consumed: boolean;
}

export type OtpCheckResult = 'ok' | 'expired' | 'too_many_attempts' | 'already_used';

/** Contrôle d'état AVANT de comparer le code : usage unique, 10 min, 4 saisies. */
export function checkOtpState(otp: OtpCheckInput, now: number): OtpCheckResult {
  if (otp.consumed) return 'already_used';
  if (now - otp.issuedAt >= OTP_TTL_MS) return 'expired';
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return 'too_many_attempts';
  return 'ok';
}

// --- Mot de passe partenaire / admin ----------------------------------------------------

export const PASSWORD_MIN_LENGTH = 8;

export function isValidPartnerPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}

export const ACTIVATION_LINK_TTL_DAYS = 7;
