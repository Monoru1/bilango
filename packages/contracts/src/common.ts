import { z } from 'zod';
import { COUNTRY_CODES } from '@gobilan/domain';

export const idSchema = z.string().min(1).max(64);
export const countrySchema = z.enum(COUNTRY_CODES as [string, ...string[]]) as unknown as z.ZodType<'BJ' | 'CI' | 'TG'>;
/** Montant FCFA entier, positif ou nul, borné pour éviter la perte de précision. */
export const fcfaSchema = z.number().int().min(0).max(999_999_999_999);
export const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const isoDateTimeSchema = z.string().datetime();
export const e164Schema = z.string().regex(/^\+\d{9,15}$/);
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const otp4Schema = z.string().regex(/^\d{4}$/);
export const otp6Schema = z.string().regex(/^\d{6}$/);
export const pinSchema = z.string().regex(/^\d{4}$/);

/** Enveloppe d'erreur unique de l'API. Les messages ne révèlent jamais l'existence d'un compte. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'validation',
      'unauthenticated',
      'forbidden',
      'not_found',
      'conflict',
      'rate_limited',
      'locked',
      'otp_invalid',
      'otp_expired',
      'otp_exhausted',
      'otp_quota',
      'subscription_blocked',
      'edit_window_closed',
      'internal',
    ]),
    message: z.string(),
    /** Secondes avant nouvel essai quand le code est `locked` ou `rate_limited`. */
    retryAfterSeconds: z.number().int().nonnegative().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
