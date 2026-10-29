import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const contestListQuerySchema = listQuerySchema.extend({
  sort: z.enum(['name', 'createdAt']).optional(),
  sponsorId: z.string().uuid().optional(),
});

export const createContestSchema = z
  .object({
    sponsorId: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    imageFileId: z.string().uuid(),
  })
  .strict();

export const updateContestSchema = z
  .object({
    sponsorId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    imageFileId: z.string().uuid().optional(),
  })
  .strict();

export const idParamSchema = z.object({ id: z.string().uuid() });
