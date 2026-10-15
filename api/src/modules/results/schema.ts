import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const resultListQuerySchema = listQuerySchema.extend({
  kind: z.enum(['assessment', 'quiz']).optional(),
  activityId: z.string().uuid().optional(),
  releaseStatus: z.enum(['withheld', 'published', 'all']).default('all'),
});

export const regradeSchema = z
  .object({
    score: z.number().min(0),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const idParamSchema = z.object({ id: z.string().uuid() });
