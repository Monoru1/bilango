import { z } from 'zod';
import { fcfaSchema, idSchema } from './common';

const lineSchema = z.object({
  label: z.string().trim().min(1).max(80),
  /** Une ligne détaillée est un nom et un montant, jamais une quantité (§6.2). */
  amount: z.number().int().min(1).max(999_999_999_999),
});

const amountSchema = z.object({
  total: fcfaSchema,
  lines: z.array(lineSchema).max(100).default([]),
});

export const reportContentSchema = z.object({
  revenue: amountSchema,
  expenses: amountSchema,
  cashIn: amountSchema,
  stockSales: z.array(z.object({ itemId: idSchema, quantity: z.number().int().min(1).max(10_000_000) })).max(500).default([]),
  note: z.string().max(500).default(''),
});

export const submitReportSchema = z.object({
  content: reportContentSchema,
  /** Obligatoire uniquement au premier bilan du business (§6.4). */
  openingCash: fcfaSchema.optional(),
  /** Clé d'idempotence générée par la PWA : un renvoi réseau ne crée jamais un doublon. */
  clientRequestId: z.string().min(8).max(64),
});

/** La date d'un bilan n'est jamais fournie par le client : pas d'antidatage (§8.4). */
export const editReportSchema = z.object({ content: reportContentSchema });

export type ReportContentInput = z.infer<typeof reportContentSchema>;
