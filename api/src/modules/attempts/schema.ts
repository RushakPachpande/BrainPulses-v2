import { z } from 'zod';

export const startAttemptSchema = z.object({
  activityId: z.string().uuid(),
  roundId: z.string().uuid().optional(),
});

export const saveAttemptSchema = z.object({
  revision: z.number().int().min(0),
  responses: z
    .array(
      z.object({
        questionVersionId: z.string().uuid(),
        answer: z.unknown(),
      }),
    )
    .default([]),
  currentQuestionIndex: z.number().int().min(0).optional(),
  closedQuestionVersionIds: z.array(z.string().uuid()).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });
