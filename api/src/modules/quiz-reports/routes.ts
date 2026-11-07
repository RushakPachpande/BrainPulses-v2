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
  activityParamSchema,
  detailQuerySchema,
  quizReportExportQuerySchema,
  quizReportQuerySchema,
  registrationParamSchema,
} from './schema.js';

export const quizReportsRouter = Router();

quizReportsRouter.use(requireAuth, requireUser, withTenantContext);

quizReportsRouter.get(
  '/',
  requireOrgAccess('view'),
  validate({ query: quizReportQuerySchema }),
  controller.list,
);
quizReportsRouter.get(
  '/export',
  requireOrgAccess('view'),
  validate({ query: quizReportExportQuerySchema }),
  controller.download,
);
quizReportsRouter.get(
  '/registrations/:registrationId',
  requireOrgAccess('view'),
  validate({ params: registrationParamSchema, query: detailQuerySchema }),
  controller.detail,
);
quizReportsRouter.post(
  '/:activityId/publish',
  requireOrgAccess('full'),
  validate({ params: activityParamSchema }),
  controller.publish,
);
