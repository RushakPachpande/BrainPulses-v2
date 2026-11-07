import { z } from 'zod';
import { FIELD_TYPES } from './rules.js';

export const idParamSchema = z.object({ id: z.string().uuid() });
export const slugParamSchema = z.object({ slug: z.string().min(1).max(80) });

export const imageParamSchema = slugParamSchema.extend({
  which: z.enum(['contest', 'sponsor']),
});

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
    options: z.array(z.string().max(120)).max(50).optional(),
    consentText: z.string().max(300).optional(),
    termsLink: z.string().max(500).optional(),
  })
  .strict();

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
    quizIds: z.array(z.string().uuid()).max(50).optional(),
  })
  .strict();

export const giveQuizzesSchema = z
  .object({
    activityIds: z.array(z.string().uuid()).min(1).max(50),
  })
  .strict();

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

export type SaveFormInput = z.infer<typeof saveFormSchema>;
