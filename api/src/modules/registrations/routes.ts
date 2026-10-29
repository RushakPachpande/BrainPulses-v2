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
  assignSchema,
  exportQuerySchema,
  registrationListQuerySchema,
  unassignSchema,
} from './schema.js';

export const registrationsRouter = Router();

registrationsRouter.use(requireAuth, requireUser, withTenantContext);

registrationsRouter.get(
  '/',
  requireOrgAccess('view'),
  validate({ query: registrationListQuerySchema }),
  controller.list,
);
registrationsRouter.post(
  '/assign',
  requireOrgAccess('edit'),
  validate({ body: assignSchema }),
  controller.assign,
);
registrationsRouter.post(
  '/unassign',
  requireOrgAccess('edit'),
  validate({ body: unassignSchema }),
  controller.unassign,
);
registrationsRouter.get(
  '/export',
  requireOrgAccess('view'),
  validate({ query: exportQuerySchema }),
  controller.exportCsv,
);
