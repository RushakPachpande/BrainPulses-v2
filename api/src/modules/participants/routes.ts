import { Router } from 'express';
import {
  requireAuth,
  requireUser,
  requireOrgAccess,
  withTenantContext,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { confirmPasswordSchema } from '../../lib/verify-acting-password.js';
import { xlsxImportUpload } from '../../lib/xlsx-upload.js';
import * as controller from './controller.js';
import {
  bulkParticipantIdsSchema,
  createParticipantSchema,
  idParamSchema,
  participantListQuerySchema,
  updateParticipantSchema,
} from './schema.js';

export const participantsRouter = Router();

participantsRouter.use(requireAuth, requireUser, withTenantContext);

participantsRouter.get(
  '/',
  requireOrgAccess('view'),
  validate({ query: participantListQuerySchema }),
  controller.list,
);
participantsRouter.get('/sample.xlsx', requireOrgAccess('view'), controller.sampleXlsx);
participantsRouter.post(
  '/import',
  requireOrgAccess('edit'),
  xlsxImportUpload.single('file'),
  controller.importFile,
);
participantsRouter.post(
  '/deactivate',
  requireOrgAccess('full'),
  validate({ body: bulkParticipantIdsSchema }),
  controller.deactivateMany,
);
participantsRouter.post(
  '/activate',
  requireOrgAccess('full'),
  validate({ body: bulkParticipantIdsSchema }),
  controller.activateMany,
);
participantsRouter.get(
  '/:id',
  requireOrgAccess('view'),
  validate({ params: idParamSchema }),
  controller.get,
);
participantsRouter.post(
  '/',
  requireOrgAccess('edit'),
  validate({ body: createParticipantSchema }),
  controller.create,
);
participantsRouter.patch(
  '/:id',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema, body: updateParticipantSchema }),
  controller.update,
);
participantsRouter.post(
  '/:id/deactivate',
  requireOrgAccess('full'),
  validate({ params: idParamSchema }),
  controller.deactivate,
);
participantsRouter.delete(
  '/:id',
  requireOrgAccess('full'),
  validate({ params: idParamSchema, body: confirmPasswordSchema }),
  controller.remove,
);
