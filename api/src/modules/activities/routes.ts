import { Router } from 'express';
import {
  requireAuth,
  requireUser,
  requireKindAccess,
  requireOrgAccess,
  withTenantContext,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  activityListQuerySchema,
  createActivitySchema,
  createRoundQuestionSchema,
  idParamSchema,
  roundIdParamSchema,
  updateActivitySchema,
} from './schema.js';
import { z } from 'zod';
import { activityReattemptsRouter } from '../attempts/admin-routes.js';

export const activitiesRouter = Router();

activitiesRouter.use(requireAuth, requireUser, withTenantContext);

activitiesRouter.use('/:id/reattempts', activityReattemptsRouter);

activitiesRouter.get(
  '/',
  requireKindAccess('view', 'query'),
  validate({ query: activityListQuerySchema }),
  controller.list,
);
activitiesRouter.get(
  '/:id',
  requireOrgAccess('view'),
  validate({ params: idParamSchema }),
  controller.get,
);
activitiesRouter.post(
  '/',
  requireKindAccess('edit', 'body'),
  validate({ body: createActivitySchema }),
  controller.create,
);
activitiesRouter.patch(
  '/:id',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema, body: updateActivitySchema }),
  controller.update,
);
activitiesRouter.post(
  '/:id/publish',
  requireOrgAccess('full'),
  validate({ params: idParamSchema }),
  controller.publish,
);
activitiesRouter.post(
  '/:id/archive',
  requireOrgAccess('full'),
  validate({ params: idParamSchema }),
  controller.archive,
);
activitiesRouter.delete(
  '/:id',
  requireOrgAccess('full'),
  validate({ params: idParamSchema }),
  controller.remove,
);

const roundQuestionParamsSchema = roundIdParamSchema.extend({
  questionId: z.string().uuid(),
});

activitiesRouter.get(
  '/:id/rounds/:roundId/questions',
  requireOrgAccess('view'),
  validate({ params: roundIdParamSchema }),
  controller.listRoundQuestions,
);
activitiesRouter.post(
  '/:id/rounds/:roundId/questions',
  requireOrgAccess('edit'),
  validate({ params: roundIdParamSchema, body: createRoundQuestionSchema }),
  controller.createRoundQuestion,
);
activitiesRouter.delete(
  '/:id/rounds/:roundId/questions/:questionId',
  requireOrgAccess('edit'),
  validate({ params: roundQuestionParamsSchema }),
  controller.deleteRoundQuestion,
);
