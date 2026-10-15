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
  idParamSchema,
  inviteUserSchema,
  updateMembershipSchema,
  userListQuerySchema,
} from './schema.js';

export const usersRouter = Router();

usersRouter.use(requireAuth, requireUser, withTenantContext);

usersRouter.get(
  '/',
  requireOrgAccess('view'),
  validate({ query: userListQuerySchema }),
  controller.list,
);
usersRouter.post(
  '/invite',
  requireOrgAccess('full'),
  validate({ body: inviteUserSchema }),
  controller.invite,
);
usersRouter.patch(
  '/:id',
  requireOrgAccess('full'),
  validate({ params: idParamSchema, body: updateMembershipSchema }),
  controller.update,
);
usersRouter.post(
  '/:id/deactivate',
  requireOrgAccess('full'),
  validate({ params: idParamSchema }),
  controller.deactivate,
);
