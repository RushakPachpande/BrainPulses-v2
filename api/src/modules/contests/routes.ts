import { Router } from 'express';
import {
  requireAuth,
  requireUser,
  requireOrgAccess,
  withTenantContext,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  contestListQuerySchema,
  createContestSchema,
  idParamSchema,
  updateContestSchema,
} from './schema.js';

export const contestsRouter = Router();

contestsRouter.use(requireAuth, requireUser, withTenantContext);

contestsRouter.get(
  '/',
  requireOrgAccess('view'),
  validate({ query: contestListQuerySchema }),
  controller.list,
);
contestsRouter.get(
  '/:id',
  requireOrgAccess('view'),
  validate({ params: idParamSchema }),
  controller.get,
);
contestsRouter.post(
  '/',
  requireOrgAccess('edit'),
  validate({ body: createContestSchema }),
  controller.create,
);
contestsRouter.patch(
  '/:id',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema, body: updateContestSchema }),
  controller.update,
);
