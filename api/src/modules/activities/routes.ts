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
  idParamSchema,
  updateActivitySchema,
} from './schema.js';

export const activitiesRouter = Router();

activitiesRouter.use(requireAuth, requireUser, withTenantContext);

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
