import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const kindSchema = z.enum(['assessment', 'quiz']);
export const flowStatusSchema = z.enum(['draft', 'active', 'completed', 'archived']);

export const registrationFieldSchema = z
  .object({
    key: z.string().trim().min(1).max(40),
    label: z.string().trim().min(1).max(80),
    type: z.enum(['text', 'email', 'phone', 'select']).default('text'),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  })
  .strict();

export const quizSettingsSchema = z
  .object({
    shuffleQuestions: z.boolean().default(true),
    shuffleOptions: z.boolean().default(true),
    scoreVisibleToStudent: z.boolean().default(false),
    answersVisibleToStudent: z.boolean().default(false),
    dailyLeaderboardVisible: z.boolean().default(true),
    overallLeaderboardVisible: z.boolean().default(true),
    dailyGroupLeaderboardVisible: z.boolean().default(true),
    overallGroupLeaderboardVisible: z.boolean().default(true),
    countsForGroupLeaderboard: z.boolean().default(true),
    leaderboardReleasedAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export const activitySettingsSchema = z
  .object({
    registrationForm: z
      .object({
        fields: z.array(registrationFieldSchema).max(20).default([]),
      })
      .strict()
      .optional(),
    assignmentRules: z
      .object({
        mode: z.enum(['manual', 'all_active_students']).default('manual'),
        notes: z.string().trim().max(500).optional(),
      })
      .strict()
      .optional(),
    quiz: quizSettingsSchema.optional(),
  })
  .strict();

export const activityRoundInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
    sortOrder: z.number().int().min(0),
    durationMinutes: z.number().int().positive().optional().nullable(),
    bankIds: z.array(z.string().uuid()).default([]),
  })
  .strict();

export const activityListQuerySchema = listQuerySchema.extend({
  kind: kindSchema,
  status: flowStatusSchema.or(z.literal('all')).default('all'),
  sort: z.enum(['name', 'code', 'createdAt', 'startsAt']).optional(),
});

export const createActivitySchema = z
  .object({
    kind: kindSchema,
    name: z.string().trim().min(1).max(200),
    subtitle: z.string().trim().max(300).optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    durationMinutes: z.number().int().positive().optional(),
    passingPercent: z.number().min(0).max(100).optional(),
    presentation: z.enum(['one_at_a_time', 'all_on_page', 'timed_card']).default('one_at_a_time'),
    bankIds: z.array(z.string().uuid()).default([]),
    rounds: z.array(activityRoundInputSchema).max(40).optional(),
    code: z.string().trim().min(1).max(40).optional(),
    settings: activitySettingsSchema.optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.kind === 'assessment' && val.rounds !== undefined && val.rounds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Assessments require at least one round when rounds are provided.',
        path: ['rounds'],
      });
    }
    if (val.kind === 'quiz' && val.rounds && val.rounds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Quizzes do not support rounds.',
        path: ['rounds'],
      });
    }
  });

export const updateActivitySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    subtitle: z.string().trim().max(300).optional().nullable(),
    startsAt: z.coerce.date().optional().nullable(),
    endsAt: z.coerce.date().optional().nullable(),
    durationMinutes: z.number().int().positive().optional().nullable(),
    passingPercent: z.number().min(0).max(100).optional().nullable(),
    presentation: z.enum(['one_at_a_time', 'all_on_page', 'timed_card']).optional(),
    bankIds: z.array(z.string().uuid()).optional(),
    rounds: z.array(activityRoundInputSchema).max(40).optional(),
    code: z.string().trim().min(1).max(40).optional(),
    settings: activitySettingsSchema.optional(),
  })
  .strict();

export const idParamSchema = z.object({ id: z.string().uuid() });

export const roundIdParamSchema = z.object({
  id: z.string().uuid(),
  roundId: z.string().uuid(),
});

export const createRoundQuestionSchema = z
  .object({
    code: z.string().trim().min(1).max(40).optional(),
    type: z.enum([
      'single_mcq',
      'multiple_mcq',
      'true_false',
      'numeric',
      'short_text',
      'long_text',
      'passage',
      'match',
      'image_mcq',
      'image_selection',
      'comprehension_mcq',
    ]),
    question: z.string().trim().min(1).max(5000),
    points: z.number().positive().max(1000).default(1),
    options: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(8),
            body: z.string().trim().min(1).max(1000),
            isCorrect: z.boolean().default(false),
            imageUrl: z.string().trim().max(2000).optional().nullable(),
          })
          .strict(),
      )
      .max(12)
      .optional(),
    answerKey: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
