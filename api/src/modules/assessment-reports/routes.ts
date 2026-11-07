import { Router } from 'express';
import {
  requireAuth,
  requireOrgAccess,
  requireUser,
  withTenantContext,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  assessmentExportQuerySchema,
  assessmentReportQuerySchema,
  detailQuerySchema,
  registrationParamSchema,
  roundParamSchema,
} from './schema.js';

export const assessmentReportsRouter = Router();

assessmentReportsRouter.use(requireAuth, requireUser, withTenantContext);

assessmentReportsRouter.get(
  '/',
  requireOrgAccess('view'),
  validate({ query: assessmentReportQuerySchema }),
  controller.list,
);
assessmentReportsRouter.get(
  '/export',
  requireOrgAccess('view'),
  validate({ query: assessmentExportQuerySchema }),
  controller.download,
);
assessmentReportsRouter.get(
  '/registrations/:registrationId',
  requireOrgAccess('view'),
  validate({ params: registrationParamSchema, query: detailQuerySchema }),
  controller.detail,
);
assessmentReportsRouter.post(
  '/rounds/:roundId/publish',
  requireOrgAccess('full'),
  validate({ params: roundParamSchema }),
  controller.publish,
);
