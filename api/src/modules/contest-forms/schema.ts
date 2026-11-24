import { z } from 'zod';
import { FIELD_TYPES, isSafeHttpUrl } from './rules.js';

export const idParamSchema = z.object({ id: z.string().uuid() });
export const registrantParamSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
});
export const slugParamSchema = z.object({ slug: z.string().min(1).max(80) });

export const imageParamSchema = slugParamSchema.extend({
  which: z.enum(['contest', 'sponsor', 'thank-you']),
});

const optionSchema = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().max(120),
  })
  .strict();

const fieldSchema = z
  .object({
    id: z.string().min(1).max(80),
    key: z.string().min(1).max(80),
    locked: z.boolean(),
    deleted: z.boolean().optional(),
    label: z.string().max(120),
    type: z.enum(FIELD_TYPES),
    required: z.boolean(),
    placeholder: z.string().max(200).optional(),
    help: z.string().max(300).optional(),
    maxCharacters: z.number().int().positive().max(2000).nullable().optional(),
    minValue: z.number().nullable().optional(),
    maxValue: z.number().nullable().optional(),
    minSelections: z.number().int().min(0).nullable().optional(),
    maxSelections: z.number().int().min(0).nullable().optional(),
    options: z.array(optionSchema).max(50).optional(),
    consentText: z.string().max(300).optional(),
    termsLink: z.string().max(500).optional(),
    text: z.string().max(1000).optional(),
    imageFileId: z.string().uuid().nullable().optional(),
    imageAlt: z.string().max(200).optional(),
  })
  .strict();

const conditionSchema = z
  .object({
    id: z.string().min(1).max(80),
    fieldId: z.string().min(1).max(80),
    op: z.enum(['is', 'is_not', 'includes', 'excludes']),
    optionId: z.string().max(80),
  })
  .strict();

const ruleSchema = z
  .object({
    id: z.string().min(1).max(80),
    /** Preferred: one join per gap between conditions. */
    joins: z
      .array(z.enum(['and', 'or']))
      .max(9)
      .optional(),
    /** Legacy single join for all conditions; migrated here and in normalizeRules. */
    join: z.enum(['and', 'or']).optional(),
    conditions: z.array(conditionSchema).max(10),
    activityIds: z.array(z.string().uuid()).max(50),
  })
  .strict()
  .transform((rule) => {
    const legacy = rule.join === 'or' ? 'or' : 'and';
    const need = Math.max(0, rule.conditions.length - 1);
    const base = rule.joins ?? [];
    const joins: Array<'and' | 'or'> = [];
    for (let i = 0; i < need; i += 1) {
      const edge = base[i];
      joins.push(edge === 'or' || edge === 'and' ? edge : legacy);
    }
    return {
      id: rule.id,
      joins,
      conditions: rule.conditions,
      activityIds: rule.activityIds,
    };
  });

export const saveFormSchema = z
  .object({
    mode: z.enum(['draft', 'step1', 'save']),
    sponsorId: z.string().uuid().nullable().optional(),
    contestId: z.string().uuid().nullable().optional(),
    opensAt: z.string().datetime().nullable().optional(),
    closesAt: z.string().datetime().nullable().optional(),
    seats: z.number().int().min(1).max(100_000).nullable().optional(),
    welcomeMessage: z.string().max(300).nullable().optional(),
    showContestImage: z.boolean().optional(),
    showSponsorName: z.boolean().optional(),
    showRegistrationCloses: z.boolean().optional(),
    showSeatsLeft: z.boolean().optional(),
    fields: z.array(fieldSchema).max(30).optional(),
    linkActive: z.boolean().optional(),
    domainRestriction: z.boolean().optional(),
    allowedDomains: z.array(z.string().max(160)).max(30).optional(),
    domainMessage: z.string().max(160).optional(),
    keepExistingId: z.boolean().optional(),
    matchRule: z.enum(['name_and_contact', 'contact_only']).optional(),
    /** Default Assignment: the activities everyone gets. */
    quizIds: z.array(z.string().uuid()).max(50).optional(),
    assignmentMode: z.enum(['all', 'rules']).optional(),
    rules: z.array(ruleSchema).max(30).optional(),
    fallbackActivityIds: z.array(z.string().uuid()).max(50).optional(),
    thankYouEnabled: z.boolean().optional(),
    thankYouKind: z.enum(['template', 'custom', 'image']).optional(),
    thankYouTitle: z.string().max(120).nullable().optional(),
    thankYouHtml: z.string().max(8000).nullable().optional(),
    thankYouImageFileId: z.string().uuid().nullable().optional(),
    thankYouShowNextSteps: z.boolean().optional(),
    thankYouShowQuizzes: z.boolean().optional(),
    thankYouButtonLabel: z.string().max(80).nullable().optional(),
    thankYouButtonUrl: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .refine((value) => value == null || value === '' || isSafeHttpUrl(value), {
        message: 'Use an http or https link.',
      }),
  })
  .strict();

export const giveQuizzesSchema = z
  .object({
    activityIds: z.array(z.string().uuid()).min(1).max(50),
  })
  .strict();

export const fieldImageParamSchema = slugParamSchema.extend({
  fieldId: z.string().min(1).max(80),
});

export const contestQuizzesQuerySchema = z.object({
  contestId: z.string().uuid(),
});

const answerValue = z.union([
  z.string().max(2000),
  z.array(z.string().max(200)).max(50),
  z.boolean(),
]);

export const registerSchema = z
  .object({
    answers: z.record(z.string(), answerValue),
  })
  .strict();

export const updateRegistrantSchema = z
  .object({
    answers: z.record(z.string(), answerValue),
  })
  .strict();

export type SaveFormInput = z.infer<typeof saveFormSchema>;
export type UpdateRegistrantInput = z.infer<typeof updateRegistrantSchema>;
