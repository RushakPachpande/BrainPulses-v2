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
    participantIds: z.array(z.string().uuid()).min(1),
  })
  .strict();

export const unassignSchema = z
  .object({
    activityId: z.string().uuid(),
    participantIds: z.array(z.string().uuid()).min(1),
  })
  .strict();

export const manualRegistrationSchema = z
  .object({
    activityId: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().max(40).optional(),
    course: z.string().trim().max(120).optional(),
    city: z.string().trim().max(120).optional(),
  })
  .strict();

export const exportQuerySchema = z.object({
  activityId: z.string().uuid(),
});
