import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const registrationListQuerySchema = listQuerySchema.extend({
  kind: z.enum(['assessment', 'quiz']).optional(),
  activityId: z.string().uuid().optional(),
  status: z.enum(['assigned', 'unassigned', 'all']).default('all'),
});

export const assignSchema = z
  .object({
    activityId: z.string().uuid(),
    studentIds: z.array(z.string().uuid()).min(1),
  })
  .strict();

export const unassignSchema = z
  .object({
    activityId: z.string().uuid(),
    studentIds: z.array(z.string().uuid()).min(1),
  })
  .strict();

export const exportQuerySchema = z.object({
  activityId: z.string().uuid(),
});
