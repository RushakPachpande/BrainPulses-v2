import { Router } from 'express';
import {
  requireAuth,
  requireUser,
  requireOrgAccess,
  withTenantContext,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { confirmPasswordSchema } from '../../lib/verify-acting-password.js';
import { xlsxImportUpload } from '../../lib/xlsx-upload.js';
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
usersRouter.get('/sample.xlsx', requireOrgAccess('view'), controller.sampleXlsx);
usersRouter.post(
  '/import',
  requireOrgAccess('full'),
  xlsxImportUpload.single('file'),
  controller.importFile,
);
usersRouter.get(
  '/:id',
  requireOrgAccess('view'),
  validate({ params: idParamSchema }),
  controller.get,
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
usersRouter.delete(
  '/:id',
  requireOrgAccess('full'),
  validate({ params: idParamSchema, body: confirmPasswordSchema }),
  controller.remove,
);
