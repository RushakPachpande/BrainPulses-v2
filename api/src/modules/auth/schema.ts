import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const selectOrganizationSchema = z.object({
  selectionToken: z.string().min(1),
  organizationId: z.string().uuid(),
});

export const studentSignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationSlug: z.string().min(1).optional(),
});
