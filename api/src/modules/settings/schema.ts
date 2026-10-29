import { z } from 'zod';

export const groupParamSchema = z.object({
  group: z.enum(['general']),
});

export const patchSettingsSchema = z
  .object({
    values: z.record(z.unknown()),
  })
  .strict();
