import { z } from 'zod';
import { idSchema } from './common';

export const checkoutSchema = z.object({ businessId: idSchema });

/** Réponse de création de transaction : le paiement se fait dans la PWA via FedaPay. */
export const checkoutResponseSchema = z.object({
  merchantReference: z.string(),
  paymentUrl: z.string().url(),
});

export const subscriptionViewSchema = z.object({
  businessId: idSchema,
  status: z.enum(['trial', 'active', 'grace', 'blocked']),
  endsAt: z.string().datetime().nullable(),
  daysRemaining: z.number().int().nonnegative(),
  popup: z.object({ kind: z.enum(['none', 'expiring', 'grace', 'blocked']), message: z.string().optional(), dismissible: z.boolean().optional() }),
  payments: z.array(z.object({ id: idSchema, paidAt: z.string().datetime(), amount: z.number().int(), provider: z.string(), reference: z.string() })),
});

/** Webhook FedaPay : seul le corps signé fait foi, jamais la redirection navigateur (§8.2). */
export const fedapayWebhookSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  entity: z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    status: z.string(),
    merchant_reference: z.string().optional(),
    amount: z.number().optional(),
    custom_metadata: z.record(z.string(), z.unknown()).optional(),
    mode: z.string().optional(),
  }).passthrough(),
}).passthrough();
