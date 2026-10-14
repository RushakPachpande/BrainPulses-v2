import { Router } from 'express';
import { requireAuth, requireUser, withTenantContext } from '../../middleware/auth.js';
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

studentsRouter.get('/', validate({ query: studentListQuerySchema }), controller.list);
studentsRouter.get('/:id', validate({ params: idParamSchema }), controller.get);
studentsRouter.post('/', validate({ body: createStudentSchema }), controller.create);
studentsRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateStudentSchema }),
  controller.update,
);
studentsRouter.post('/:id/deactivate', validate({ params: idParamSchema }), controller.deactivate);
