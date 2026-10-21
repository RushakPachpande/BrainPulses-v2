import { Router } from 'express';
import {
  requireAuth,
  requireOrgAccess,
  requireUser,
  withTenantContext,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './admin-controller.js';
import {
  activityIdParamSchema,
  attemptIdParamSchema,
  disqualifyBodySchema,
  grantReattemptBodySchema,
} from './admin-schema.js';

export const adminAttemptsRouter = Router();

adminAttemptsRouter.use(requireAuth, requireUser, withTenantContext);

adminAttemptsRouter.post(
  '/:id/disqualify',
  requireOrgAccess('full'),
  validate({ params: attemptIdParamSchema, body: disqualifyBodySchema }),
  controller.disqualify,
);

adminAttemptsRouter.post(
  '/:id/requalify',
  requireOrgAccess('full'),
  validate({ params: attemptIdParamSchema }),
  controller.requalify,
);

export const activityReattemptsRouter = Router({ mergeParams: true });

activityReattemptsRouter.get(
  '/',
  requireOrgAccess('view'),
  validate({ params: activityIdParamSchema }),
  controller.listReattempts,
);

activityReattemptsRouter.post(
  '/',
  requireOrgAccess('full'),
  validate({ params: activityIdParamSchema, body: grantReattemptBodySchema }),
  controller.grantReattempt,
);
