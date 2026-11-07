import { z } from 'zod';

export const assessmentSortKeySchema = z.enum([
  'code',
  'name',
  'email',
  'phone',
  'assessment',
  'round',
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

export const assessmentReportQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(''),
  activityId: z.string().uuid().optional(),
  roundId: z.string().uuid().optional(),
  activityStatus: z.enum(['any', 'active', 'expired', 'inactive']).default('any'),
  attemptStatus: z.enum(['any', 'completed', 'in_progress', 'not_started']).default('any'),
  autoSubmitted: z.enum(['any', 'yes', 'no']).default('any'),
  sort: assessmentSortKeySchema.default('submitted'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => value === 10 || value === 20 || value === 50)
    .default(10),
});

export const assessmentExportQuerySchema = assessmentReportQuerySchema
  .omit({ page: true, pageSize: true })
  .extend({
    format: z.enum(['xlsx', 'csv']).default('xlsx'),
    includeAbsent: z.enum(['true', 'false']).default('false'),
    columns: z.string().trim().min(1).max(500),
  });

export const registrationParamSchema = z.object({
  registrationId: z.string().uuid(),
});

export const roundParamSchema = z.object({
  roundId: z.string().uuid(),
});

export const detailQuerySchema = z.object({
  roundId: z.string().uuid(),
  attemptId: z.string().uuid().optional(),
});
