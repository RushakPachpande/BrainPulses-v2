import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';
import { unprocessable } from '../../lib/errors.js';

export const kindSchema = z.enum(['assessment', 'quiz']);

export type BankKind = z.infer<typeof kindSchema>;

/** Full DB enum including legacy passage/match. */
export const questionTypeSchema = z.enum([
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
]);

export type QuestionTypeValue = z.infer<typeof questionTypeSchema>;

/** Types that may be newly authored into a quiz bank. */
export const QUIZ_AUTHORABLE_TYPES = new Set<string>(['single_mcq']);

/** Types allowed when attaching an existing quiz bank to a quiz activity (includes legacy). */
export const QUIZ_ATTACH_ALLOWED_TYPES = new Set<string>(['single_mcq', 'image_mcq']);

export const ASSESSMENT_AUTHORABLE_TYPES = new Set<string>([
  'single_mcq',
  'multiple_mcq',
  'true_false',
  'numeric',
  'short_text',
  'long_text',
  'image_mcq',
  'image_selection',
  'comprehension_mcq',
]);

export function authorableTypesForKind(kind: BankKind): Set<string> {
  return kind === 'quiz' ? QUIZ_AUTHORABLE_TYPES : ASSESSMENT_AUTHORABLE_TYPES;
}

/**
 * Enforce quiz = single_mcq only for new authoring.
 * Legacy `image_mcq` on quiz banks is not creatable; updates coerce via service.
 */
export function assertTypeAllowedForKind(kind: BankKind, type: string): void {
  const allowed = authorableTypesForKind(kind);
  if (!allowed.has(type)) {
    if (kind === 'quiz') {
      throw unprocessable(
        `Quiz banks only support single-choice questions (single_mcq). Got “${type}”.`,
      );
    }
    throw unprocessable(`Type “${type}” is not allowed for assessment banks.`);
  }
}

export function isOptionFilled(o: { body?: string; imageUrl?: string | null }): boolean {
  const body = (o.body ?? '').trim();
  const image = typeof o.imageUrl === 'string' ? o.imageUrl.trim() : '';
  return Boolean(body || image);
}

/** Prefer questionImageUrl; fold stemImageUrl into it for consistent storage. */
export function normalizeAnswerKeyImages(
  answerKey: Record<string, unknown>,
): Record<string, unknown> {
  const key = { ...answerKey };
  const fromQuestion = typeof key.questionImageUrl === 'string' ? key.questionImageUrl.trim() : '';
  const fromStem = typeof key.stemImageUrl === 'string' ? key.stemImageUrl.trim() : '';
  const url = fromQuestion || fromStem;
  delete key.stemImageUrl;
  if (url) key.questionImageUrl = url;
  else delete key.questionImageUrl;
  return key;
}

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

export const optionSchema = z
  .object({
    label: z.string().min(1).max(10),
    body: z.string().default(''),
    isCorrect: z.boolean().default(false),
    imageUrl: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((o, ctx) => {
    if (!isOptionFilled(o)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Each option needs text, an image URL, or both.',
        path: ['body'],
      });
    }
  });

const questionBaseSchema = z.object({
  type: questionTypeSchema,
  question: z.string().trim().min(1),
  points: z.number().positive().default(1),
  code: z.string().trim().min(1).max(40).optional(),
  options: z.array(optionSchema).default([]),
  answerKey: z.record(z.unknown()).default({}),
});

function validateQuestionPayload(data: z.infer<typeof questionBaseSchema>, ctx: z.RefinementCtx) {
  const { type, options, answerKey } = data;
  const filled = options.filter((o) => isOptionFilled(o));
  const correctCount = filled.filter((o) => o.isCorrect).length;
  const key = answerKey ?? {};

  switch (type) {
    case 'single_mcq':
    case 'image_mcq':
    case 'passage':
    case 'match':
      if (filled.length < 2) {
        ctx.addIssue({ code: 'custom', message: 'Add at least two options.', path: ['options'] });
      }
      if (correctCount !== 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'Mark exactly one correct option.',
          path: ['options'],
        });
      }
      break;
    case 'true_false': {
      if (filled.length !== 2) {
        ctx.addIssue({
          code: 'custom',
          message: 'True/False requires exactly two options.',
          path: ['options'],
        });
      }
      if (correctCount !== 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'Mark exactly one correct option.',
          path: ['options'],
        });
      }
      break;
    }
    case 'multiple_mcq':
    case 'image_selection':
      if (filled.length < 2) {
        ctx.addIssue({ code: 'custom', message: 'Add at least two options.', path: ['options'] });
      }
      if (correctCount < 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'Mark at least one correct option.',
          path: ['options'],
        });
      }
      if (type === 'image_selection') {
        const missingImage = filled.some(
          (o) => !(typeof o.imageUrl === 'string' && o.imageUrl.trim()),
        );
        if (missingImage) {
          ctx.addIssue({
            code: 'custom',
            message: 'Each image-selection option needs an image URL.',
            path: ['options'],
          });
        }
      }
      break;
    case 'comprehension_mcq': {
      const passage = typeof key.passageText === 'string' ? key.passageText.trim() : '';
      if (!passage) {
        ctx.addIssue({
          code: 'custom',
          message: 'Passage text is required.',
          path: ['answerKey', 'passageText'],
        });
      }
      if (filled.length < 2 || filled.length > 6) {
        ctx.addIssue({
          code: 'custom',
          message: 'Comprehension questions need 2–6 options.',
          path: ['options'],
        });
      }
      if (correctCount !== 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'Mark exactly one correct option.',
          path: ['options'],
        });
      }
      break;
    }
    case 'numeric': {
      const value = key.value;
      if (value === undefined || value === null || value === '') {
        ctx.addIssue({
          code: 'custom',
          message: 'Numeric answer value is required.',
          path: ['answerKey', 'value'],
        });
      } else if (Number.isNaN(Number(value))) {
        ctx.addIssue({
          code: 'custom',
          message: 'Numeric answer must be a number.',
          path: ['answerKey', 'value'],
        });
      }
      break;
    }
    case 'short_text':
    case 'long_text':
      // Reference answer optional; when absent, scoring leaves unscored.
      break;
    default:
      break;
  }
}

export const createQuestionSchema = questionBaseSchema
  .strict()
  .superRefine(validateQuestionPayload);

export const updateQuestionSchema = questionBaseSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.type === undefined) return;
    // Only validate shape when type + enough fields are present for a full rewrite.
    if (data.question === undefined && data.options === undefined && data.answerKey === undefined) {
      return;
    }
    validateQuestionPayload(
      {
        type: data.type,
        question: data.question ?? 'x',
        points: data.points ?? 1,
        options: data.options ?? [],
        answerKey: data.answerKey ?? {},
      },
      ctx,
    );
  });

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
