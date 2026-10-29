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
import {
  createSponsorSchema,
  idParamSchema,
  sponsorListQuerySchema,
  updateSponsorSchema,
} from './schema.js';

export const sponsorsRouter = Router();

sponsorsRouter.use(requireAuth, requireUser, withTenantContext);

sponsorsRouter.get(
  '/',
  requireOrgAccess('view'),
  validate({ query: sponsorListQuerySchema }),
  controller.list,
);
sponsorsRouter.get(
  '/:id',
  requireOrgAccess('view'),
  validate({ params: idParamSchema }),
  controller.get,
);
sponsorsRouter.post(
  '/',
  requireOrgAccess('edit'),
  validate({ body: createSponsorSchema }),
  controller.create,
);
sponsorsRouter.patch(
  '/:id',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema, body: updateSponsorSchema }),
  controller.update,
);
sponsorsRouter.delete(
  '/:id',
  requireOrgAccess('full'),
  validate({ params: idParamSchema, body: confirmPasswordSchema }),
  controller.remove,
);
