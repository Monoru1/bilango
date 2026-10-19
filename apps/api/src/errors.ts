import type { ApiError } from '@gobilan/contracts';

export type ErrorCode = ApiError['error']['code'];

const STATUS: Record<ErrorCode, number> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  locked: 423,
  otp_invalid: 400,
  otp_expired: 400,
  otp_exhausted: 429,
  otp_quota: 429,
  subscription_blocked: 402,
  edit_window_closed: 403,
  internal: 500,
};

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
  get status(): number {
    return STATUS[this.code];
  }
  toBody(): ApiError {
    return { error: { code: this.code, message: this.message, ...(this.retryAfterSeconds !== undefined ? { retryAfterSeconds: this.retryAfterSeconds } : {}) } };
  }
}

/**
 * 404 volontaire pour toute ressource d'un autre business : on ne confirme jamais l'existence
 * d'une donnée à qui n'y a pas droit (défense contre l'énumération / IDOR).
 */
export const notFound = (what = 'Ressource introuvable.') => new AppError('not_found', what);
export const forbidden = (what = 'Action non autorisée.') => new AppError('forbidden', what);
