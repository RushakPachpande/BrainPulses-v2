import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const kindSchema = z.enum(['assessment', 'quiz']);
export const flowStatusSchema = z.enum(['draft', 'active', 'completed', 'archived']);

export const activityListQuerySchema = listQuerySchema.extend({
  kind: kindSchema,
  status: flowStatusSchema.or(z.literal('all')).default('all'),
  sort: z.enum(['name', 'code', 'createdAt', 'startsAt']).optional(),
});

export const createActivitySchema = z
  .object({
    kind: kindSchema,
    name: z.string().trim().min(1).max(200),
    subtitle: z.string().trim().max(300).optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    durationMinutes: z.number().int().positive().optional(),
    passingPercent: z.number().min(0).max(100).optional(),
    presentation: z.enum(['one_at_a_time', 'all_on_page', 'timed_card']).default('one_at_a_time'),
    bankIds: z.array(z.string().uuid()).default([]),
    code: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export const updateActivitySchema = createActivitySchema.partial().omit({ kind: true }).strict();

export const idParamSchema = z.object({ id: z.string().uuid() });
