import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const studentListQuerySchema = listQuerySchema.extend({
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  sort: z.enum(['name', 'code', 'createdAt', 'registered']).optional(),
});

export const createStudentSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.string().email(),
    phone: z.string().trim().max(40).optional(),
    course: z.string().trim().max(120).optional(),
    city: z.string().trim().max(120).optional(),
    code: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export const updateStudentSchema = createStudentSchema
  .partial()
  .extend({
    phone: z.string().trim().max(40).nullable().optional(),
    course: z.string().trim().max(120).nullable().optional(),
    city: z.string().trim().max(120).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const idParamSchema = z.object({ id: z.string().uuid() });
