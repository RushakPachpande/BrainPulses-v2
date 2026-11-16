import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const registrationListQuerySchema = listQuerySchema.extend({
  kind: z.enum(['assessment', 'quiz']).optional(),
  activityId: z.string().uuid().optional(),
  status: z.enum(['assigned', 'unassigned', 'all']).default('all'),
});

export const assignableQuerySchema = z.object({
  activityId: z.string().uuid(),
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

const answerValueSchema = z.union([
  z.string().max(5000),
  z.array(z.string().max(200)).max(50),
  z.boolean(),
]);

const basicManualSchema = z
  .object({
    activityId: z.string().uuid(),
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().min(1).max(40),
  })
  .strict();

const formManualSchema = z
  .object({
    activityId: z.string().uuid(),
    formId: z.string().uuid(),
    answers: z.record(z.string().min(1).max(80), answerValueSchema),
  })
  .strict();

export const manualRegistrationSchema = z.union([formManualSchema, basicManualSchema]);

export const exportQuerySchema = z.object({
  activityId: z.string().uuid(),
});
