import { z } from 'zod';
import { enumListSchema, uuidListSchema } from '../../lib/query-list.js';

export const reportSortKeySchema = z.enum([
  'code',
  'name',
  'email',
  'phone',
  'contest',
  'quiz',
  'attemptsUsed',
  'score',
  'maxScore',
  'percent',
  'result',
  'correct',
  'questionCount',
  'skipped',
  'negative',
  'timeTaken',
  'submitted',
  'autoSubmitted',
  'attemptStatus',
]);

export const quizReportQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(''),
  contestId: uuidListSchema(),
  activityId: uuidListSchema(),
  quizStatus: enumListSchema(['active', 'expired', 'inactive'] as const),
  attemptStatus: enumListSchema(['completed', 'in_progress', 'not_started'] as const),
  autoSubmitted: enumListSchema(['yes', 'no'] as const),
  sort: reportSortKeySchema.default('submitted'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => value === 10 || value === 20 || value === 50)
    .default(10),
});

export const quizReportExportQuerySchema = quizReportQuerySchema
  .omit({ page: true, pageSize: true })
  .extend({
    format: z.enum(['xlsx']).default('xlsx'),
    includeAbsent: z.enum(['true', 'false']).default('false'),
    columns: z.string().trim().min(1).max(500),
  });

export const registrationParamSchema = z.object({
  registrationId: z.string().uuid(),
});

export const activityParamSchema = z.object({
  activityId: z.string().uuid(),
});

export const detailQuerySchema = z.object({
  attemptId: z.string().uuid().optional(),
});
