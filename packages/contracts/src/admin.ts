import { z } from 'zod';
import { dayKeySchema, idSchema } from './common';

export const validatePayoutSchema = z.object({
  partnerId: idSchema,
  cycleDate: dayKeySchema,
  /** Frais de transaction de l'opérateur, déduits du versement (§10.10). */
  fees: z.number().int().min(0),
  transferReference: z.string().trim().max(120).optional(),
});

export const reversePayoutSchema = z.object({ payoutId: idSchema, reason: z.string().trim().min(3).max(300) });

export const excludeReferralSchema = z.object({ referralId: idSchema, reason: z.string().trim().min(3).max(300) });

export const adminAllowlistChangeSchema = z.discriminatedUnion('action', [
  z.object({ email: z.string().email().transform(s => s.toLowerCase()), action: z.literal('add'), password: z.string().min(12).max(256) }),
  z.object({ email: z.string().email().transform(s => s.toLowerCase()), action: z.literal('remove') }),
]);
export const adminAllowlistConfirmSchema = z.object({ requestId: idSchema, code: z.string().regex(/^\d{6}$/) });
