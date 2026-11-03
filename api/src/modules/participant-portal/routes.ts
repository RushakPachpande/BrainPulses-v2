import { Router } from 'express';
import { requireAuth, requireParticipant, withTenantContext } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  idParamSchema,
  patchProfileSchema,
  participantActivitiesQuerySchema,
  participantResultsQuerySchema,
} from './schema.js';

export const participantPortalRouter = Router();

participantPortalRouter.use(requireAuth, requireParticipant, withTenantContext);

participantPortalRouter.get('/me', controller.me);
participantPortalRouter.get('/pages', controller.pages);
participantPortalRouter.patch('/me', validate({ body: patchProfileSchema }), controller.patchMe);
participantPortalRouter.get(
  '/activities',
  validate({ query: participantActivitiesQuerySchema }),
  controller.activities,
);
participantPortalRouter.get(
  '/results',
  validate({ query: participantResultsQuerySchema }),
  controller.results,
);
participantPortalRouter.get(
  '/results/:id',
  validate({ params: idParamSchema }),
  controller.resultDetail,
);
