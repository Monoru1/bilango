import { z } from 'zod';

/**
 * Types de notification Web Push (cahier §9.2). Le service worker (`apps/pwa/public/sw.js`)
 * construit lui-même le texte à partir de ce type : la charge utile ne transporte JAMAIS de montant
 * (elle peut s'afficher sur l'écran verrouillé).
 */
export const pushTypeSchema = z.enum(['report_sent', 'report_edited', 'reminder', 'expiring', 'new_device', 'payment_confirmed']);
export type PushType = z.infer<typeof pushTypeSchema>;

/** Charge utile envoyée au navigateur. Volontairement minimale : type, nom du business, badge. */
export const pushPayloadSchema = z.object({
  type: pushTypeSchema,
  businessName: z.string().max(80).optional(),
  badge: z.boolean().optional(),
});
export type PushMessage = z.infer<typeof pushPayloadSchema>;

/** Abonnement tel que fourni par `PushSubscription.toJSON()`. Seuls les points d'accès HTTPS sont acceptés. */
export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2048)
    .refine((u) => u.startsWith('https://'), 'Le point d’accès doit être en HTTPS.'),
  keys: z.object({
    p256dh: z.string().min(16).max(256),
    auth: z.string().min(8).max(128),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().url().max(2048) });
