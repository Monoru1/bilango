import { z } from 'zod';
import { countrySchema, emailSchema, idSchema } from './common';

export const partnerRoleSchema = z.enum(['agent', 'manager', 'influencer']);
export const mobileMoneyNetworkSchema = z.enum(['MTN', 'Moov', 'Orange', 'Wave', 'TMoney']);

/** Bloc Paiement : seule donnée modifiable par le partenaire, sans OTP (§10.10). */
export const payoutBlockSchema = z.object({
  phone: z.string().regex(/^\+\d{9,15}$/),
  network: mobileMoneyNetworkSchema,
  displayName: z.string().trim().min(2).max(80),
});

export const createPartnerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  country: countrySchema,
  email: emailSchema,
  role: z.enum(['manager', 'influencer']),
  /** Code promo choisi par l'admin pour un influenceur (§10.2). */
  promoCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/).optional(),
});

export const registerAgentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: emailSchema,
  promoCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/),
});

export const referralRowSchema = z.object({
  /** Jamais de téléphone, ni complet ni partiel (§10.6). */
  businessName: z.string(),
  registeredAt: z.string().datetime(),
  status: z.enum(['paid', 'trial', 'expired']),
  daysLeft: z.number().int().nonnegative(),
});

export const agreementAcceptanceSchema = z.object({ partnerId: idSchema, role: partnerRoleSchema, version: z.string(), acceptedAt: z.string().datetime() });
