import { z } from 'zod';
import { audiencePlatforms, DAY_MS } from '@gobilan/domain';

export const audienceId = z.uuid({ version: 'v4' });
const fields = { id: audienceId, visitor: audienceId, platform: z.enum(audiencePlatforms) };
export const audienceContext = z.strictObject(fields);
export const audienceEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...fields, kind: z.literal('visit'), session: audienceId,
    source: z.enum(['direct', 'whatsapp', 'facebook', 'tiktok', 'other']),
    referral: z.string().regex(/^[A-Z0-9]{4,20}$/).optional(),
  }),
  z.strictObject({ ...fields, kind: z.enum(['install_click', 'android_install', 'first_open']) }),
]);
export const audienceDeleteSchema = z.strictObject({ visitor: audienceId });
export const audiencePeriodSchema = z.strictObject({ from: z.iso.date(), to: z.iso.date() })
  .refine(({ from, to }) => {
    const duration = Date.parse(to) - Date.parse(from);
    return duration >= 0 && duration < 90 * DAY_MS;
  }, 'Choisissez une période de 1 à 90 jours.');

export type AudienceEvent = z.infer<typeof audienceEventSchema> | (z.infer<typeof audienceContext> & { kind: 'registration' });
