import { Router } from 'express';
import { requireAuth, requireStudent, withTenantContext } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  idParamSchema,
  patchProfileSchema,
  studentActivitiesQuerySchema,
  studentResultsQuerySchema,
} from './schema.js';

export const studentPortalRouter = Router();

studentPortalRouter.use(requireAuth, requireStudent, withTenantContext);

studentPortalRouter.get('/me', controller.me);
studentPortalRouter.get('/pages', controller.pages);
studentPortalRouter.patch('/me', validate({ body: patchProfileSchema }), controller.patchMe);
studentPortalRouter.get(
  '/activities',
  validate({ query: studentActivitiesQuerySchema }),
  controller.activities,
);
studentPortalRouter.get(
  '/results',
  validate({ query: studentResultsQuerySchema }),
  controller.results,
);
studentPortalRouter.get(
  '/results/:id',
  validate({ params: idParamSchema }),
  controller.resultDetail,
);
