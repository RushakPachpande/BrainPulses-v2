import { z } from 'zod';

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
  contestId: z.string().uuid().optional(),
  activityId: z.string().uuid().optional(),
  quizStatus: z.enum(['any', 'active', 'expired', 'inactive']).default('any'),
  attemptStatus: z.enum(['any', 'completed', 'in_progress', 'not_started']).default('any'),
  autoSubmitted: z.enum(['any', 'yes', 'no']).default('any'),
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
    format: z.enum(['xlsx', 'csv']).default('xlsx'),
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
