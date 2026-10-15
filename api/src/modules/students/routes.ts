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
