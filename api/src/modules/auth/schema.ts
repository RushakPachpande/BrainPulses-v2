import { z } from 'zod';
import { isValidNationalMobile, UNIQUE_ID_RE } from '../../lib/login-validation.js';

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const selectOrganizationSchema = z.object({
  selectionToken: z.string().min(1),
  organizationId: z.string().uuid(),
});

export const studentSignInByCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(UNIQUE_ID_RE, 'Unique ID must be 4–40 letters, digits, hyphens, or underscores'),
  organizationSlug: z.string().min(1).optional(),
  replaceSession: z.boolean().optional(),
});

const phonePartsObject = z.object({
  countryCode: z.string().trim().min(1).max(8),
  mobileNumber: z.string().trim().min(1).max(20),
  organizationSlug: z.string().min(1).optional(),
});

function refinePhoneParts<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const body = data as z.infer<typeof phonePartsObject>;
    if (!isValidNationalMobile(body.countryCode, body.mobileNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid phone number for the selected country code',
        path: ['mobileNumber'],
      });
    }
  });
}

export const studentRequestOtpSchema = refinePhoneParts(phonePartsObject);

export const studentResendOtpSchema = refinePhoneParts(phonePartsObject);

export const studentVerifyOtpSchema = refinePhoneParts(
  phonePartsObject.extend({
    otp: z.string().trim().regex(/^\d{6}$/),
    replaceSession: z.boolean().optional(),
  }),
);
