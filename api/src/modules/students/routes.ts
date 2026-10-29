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
  bulkStudentIdsSchema,
  createStudentSchema,
  idParamSchema,
  studentListQuerySchema,
  updateStudentSchema,
} from './schema.js';

export const studentsRouter = Router();

studentsRouter.use(requireAuth, requireUser, withTenantContext);

studentsRouter.get(
  '/',
  requireOrgAccess('view'),
  validate({ query: studentListQuerySchema }),
  controller.list,
);
studentsRouter.get('/sample.xlsx', requireOrgAccess('view'), controller.sampleXlsx);
studentsRouter.post(
  '/import',
  requireOrgAccess('edit'),
  xlsxImportUpload.single('file'),
  controller.importFile,
);
studentsRouter.post(
  '/deactivate',
  requireOrgAccess('full'),
  validate({ body: bulkStudentIdsSchema }),
  controller.deactivateMany,
);
studentsRouter.post(
  '/activate',
  requireOrgAccess('full'),
  validate({ body: bulkStudentIdsSchema }),
  controller.activateMany,
);
studentsRouter.get(
  '/:id',
  requireOrgAccess('view'),
  validate({ params: idParamSchema }),
  controller.get,
);
studentsRouter.post(
  '/',
  requireOrgAccess('edit'),
  validate({ body: createStudentSchema }),
  controller.create,
);
studentsRouter.patch(
  '/:id',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema, body: updateStudentSchema }),
  controller.update,
);
studentsRouter.post(
  '/:id/deactivate',
  requireOrgAccess('full'),
  validate({ params: idParamSchema }),
  controller.deactivate,
);
studentsRouter.delete(
  '/:id',
  requireOrgAccess('full'),
  validate({ params: idParamSchema, body: confirmPasswordSchema }),
  controller.remove,
);
