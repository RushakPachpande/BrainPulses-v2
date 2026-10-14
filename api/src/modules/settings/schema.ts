import { z } from 'zod';

export const groupParamSchema = z.object({
  group: z.enum(['general', 'access', 'notifications', 'system']),
});

export const patchSettingsSchema = z.object({
  values: z.record(z.unknown()),
});
