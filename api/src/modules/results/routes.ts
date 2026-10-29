import { Router } from 'express';
import {
  requireAuth,
  requireUser,
  requireOrgAccess,
  withTenantContext,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { confirmPasswordSchema } from '../../lib/verify-acting-password.js';
import * as controller from './controller.js';
import { idParamSchema, regradeSchema, resultListQuerySchema } from './schema.js';

export const resultsRouter = Router();

resultsRouter.use(requireAuth, requireUser, withTenantContext);

resultsRouter.get(
  '/',
  requireOrgAccess('view'),
  validate({ query: resultListQuerySchema }),
  controller.list,
);
resultsRouter.get(
  '/:id',
  requireOrgAccess('view'),
  validate({ params: idParamSchema }),
  controller.get,
);
resultsRouter.post(
  '/:id/publish',
  requireOrgAccess('full'),
  validate({ params: idParamSchema }),
  controller.publish,
);
resultsRouter.post(
  '/:id/regrade',
  requireOrgAccess('full'),
  validate({ params: idParamSchema, body: regradeSchema }),
  controller.regrade,
);
resultsRouter.delete(
  '/:id',
  requireOrgAccess('full'),
  validate({ params: idParamSchema, body: confirmPasswordSchema }),
  controller.remove,
);
