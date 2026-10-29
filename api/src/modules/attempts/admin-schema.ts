import { z } from 'zod';

export const attemptIdParamSchema = z.object({ id: z.string().uuid() });

export const disqualifyBodySchema = z
  .object({
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const grantReattemptBodySchema = z
  .object({
    studentId: z.string().uuid(),
    mode: z.enum(['continue', 'restart']),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const activityIdParamSchema = z.object({ id: z.string().uuid() });
