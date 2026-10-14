import { Router } from 'express';
import { requireAuth, requireUser, withTenantContext } from '../../middleware/auth.js';
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

registrationsRouter.get('/', validate({ query: registrationListQuerySchema }), controller.list);
registrationsRouter.post('/assign', validate({ body: assignSchema }), controller.assign);
registrationsRouter.post('/unassign', validate({ body: unassignSchema }), controller.unassign);
registrationsRouter.get('/export', validate({ query: exportQuerySchema }), controller.exportCsv);
