import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const studentActivitiesQuerySchema = listQuerySchema.extend({
  kind: z.enum(['assessment', 'quiz', 'all']).default('all'),
});

export const studentResultsQuerySchema = listQuerySchema.extend({
  kind: z.enum(['assessment', 'quiz', 'all']).default('all'),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export const patchProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
  })
  .refine((v) => v.name !== undefined, { message: 'At least one field is required.' });
