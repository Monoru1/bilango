import { z } from 'zod';
import { countrySchema, dayKeySchema, fcfaSchema, idSchema, e164Schema } from './common';

export const permissionLevelSchema = z.enum(['entry', 'full', 'readonly']);
export const sectorSchema = z.enum(['bar_restaurant', 'boutique', 'ecommerce', 'other']);

export const createBusinessSchema = z.object({
  name: z.string().trim().min(1).max(80),
  country: countrySchema,
  sector: sectorSchema,
  stockEnabled: z.boolean().default(false),
});

export const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(40),
  level: permissionLevelSchema,
});

export const inviteMemberSchema = z.object({
  phone: e164Schema,
  roleId: idSchema,
});

export const respondInvitationSchema = z.object({ accept: z.boolean() });

export const updateBusinessSchema = z.object({
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  stockEnabled: z.boolean().optional(),
  name: z.string().trim().min(1).max(80).optional(),
});

export const declareOpeningCashSchema = z.object({ amount: fcfaSchema, day: dayKeySchema });

export const stockItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  initialQuantity: z.number().int().min(0).max(10_000_000),
});
