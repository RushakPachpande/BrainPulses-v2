import { Router } from 'express';
import { requireAuth, requireUser, withTenantContext } from '../../middleware/auth.js';
import * as controller from './controller.js';

export const jobsRouter = Router();

jobsRouter.use(requireAuth, requireUser, withTenantContext);

jobsRouter.get('/:jobId', controller.getJob);
jobsRouter.get('/:jobId/download', controller.downloadExport);
