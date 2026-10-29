import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const sponsorListQuerySchema = listQuerySchema.extend({
  sort: z.enum(['name', 'createdAt']).optional(),
});

export const createSponsorSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    imageFileId: z.string().uuid(),
  })
  .strict();

export const updateSponsorSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    imageFileId: z.string().uuid().optional(),
  })
  .strict();

export const idParamSchema = z.object({ id: z.string().uuid() });
