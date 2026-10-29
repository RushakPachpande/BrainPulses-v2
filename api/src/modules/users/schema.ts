import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const accessLevelSchema = z.enum(['full', 'edit', 'view', 'none']);

export const userListQuerySchema = listQuerySchema.extend({
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  sort: z.enum(['name', 'email', 'createdAt']).optional(),
});

export const inviteUserSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    role: z.enum(['super_admin', 'admin']).default('admin'),
    assessmentAccess: accessLevelSchema.default('full'),
    quizAccess: accessLevelSchema.default('full'),
  })
  .strict();

export const updateMembershipSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().email().optional(),
    role: z.enum(['super_admin', 'admin']).optional(),
    assessmentAccess: accessLevelSchema.optional(),
    quizAccess: accessLevelSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const idParamSchema = z.object({ id: z.string().uuid() });
