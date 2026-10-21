import { z } from 'zod';

export const activityLeaderboardQuerySchema = z.object({
  scope: z.enum(['daily', 'overall']).default('overall'),
  kind: z.enum(['individual', 'group']).default('individual'),
});

export const orgLeaderboardQuerySchema = activityLeaderboardQuerySchema;

export const activityIdParamSchema = z.object({ id: z.string().uuid() });
