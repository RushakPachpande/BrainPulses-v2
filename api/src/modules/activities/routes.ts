import { Router } from 'express';
import {
  requireAuth,
  requireUser,
  requireKindAccess,
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
activitiesRouter.get('/:id', validate({ params: idParamSchema }), controller.get);
activitiesRouter.post(
  '/',
  requireKindAccess('edit', 'body'),
  validate({ body: createActivitySchema }),
  controller.create,
);
activitiesRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateActivitySchema }),
  controller.update,
);
activitiesRouter.post('/:id/publish', validate({ params: idParamSchema }), controller.publish);
activitiesRouter.post('/:id/archive', validate({ params: idParamSchema }), controller.archive);
