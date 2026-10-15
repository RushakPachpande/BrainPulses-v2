import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const kindSchema = z.enum(['assessment', 'quiz']);
export const questionTypeSchema = z.enum([
  'single_mcq',
  'multiple_mcq',
  'numeric',
  'short_text',
  'passage',
  'match',
  'image_mcq',
]);

export const bankListQuerySchema = listQuerySchema.extend({
  kind: kindSchema,
  status: z.enum(['draft', 'active', 'completed', 'archived', 'all']).default('all'),
});

export const createBankSchema = z
  .object({
    kind: kindSchema,
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional(),
    presentation: z.enum(['one_at_a_time', 'all_on_page', 'timed_card']).default('one_at_a_time'),
    code: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export const updateBankSchema = createBankSchema
  .partial()
  .omit({ kind: true })
  .extend({
    status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  })
  .strict();

export const optionSchema = z.object({
  label: z.string().min(1).max(10),
  body: z.string().min(1),
  isCorrect: z.boolean().default(false),
});

export const createQuestionSchema = z
  .object({
    type: questionTypeSchema,
    stem: z.string().trim().min(1),
    points: z.number().positive().default(1),
    code: z.string().trim().min(1).max(40).optional(),
    options: z.array(optionSchema).default([]),
    answerKey: z.record(z.unknown()).default({}),
  })
  .strict();

export const updateQuestionSchema = createQuestionSchema.partial().strict();

export const idParamSchema = z.object({ id: z.string().uuid() });
export const bankQuestionParamsSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid(),
});

export const importBodySchema = z
  .object({
    csv: z.string().min(1),
  })
  .strict();
