import { Router } from 'express';
import {
  requireAuth,
  requireOrgAccess,
  requireStudent,
  requireUser,
  withTenantContext,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  activityIdParamSchema,
  activityLeaderboardQuerySchema,
  orgLeaderboardQuerySchema,
} from './schema.js';

/** Admin leaderboards (mounted under /api/leaderboards) */
export const leaderboardsRouter = Router();
leaderboardsRouter.use(requireAuth, requireUser, withTenantContext);

leaderboardsRouter.get(
  '/quizzes',
  validate({ query: orgLeaderboardQuerySchema }),
  controller.orgBoard,
);

leaderboardsRouter.get(
  '/activities/:id',
  requireOrgAccess('view'),
  validate({ params: activityIdParamSchema, query: activityLeaderboardQuerySchema }),
  controller.activityBoard,
);

/** Student leaderboards (mounted under /api/student/leaderboards) */
export const studentLeaderboardsRouter = Router();
studentLeaderboardsRouter.use(requireAuth, requireStudent, withTenantContext);

studentLeaderboardsRouter.get(
  '/quizzes',
  validate({ query: orgLeaderboardQuerySchema }),
  controller.orgBoard,
);

studentLeaderboardsRouter.get(
  '/activities/:id',
  validate({ params: activityIdParamSchema, query: activityLeaderboardQuerySchema }),
  controller.activityBoard,
);
