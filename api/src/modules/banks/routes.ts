import { Router } from 'express';
import {
  requireAuth,
  requireUser,
  requireKindAccess,
  requireOrgAccess,
  withTenantContext,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  bankListQuerySchema,
  bankQuestionParamsSchema,
  bulkQuestionStatusSchema,
  createBankSchema,
  createQuestionSchema,
  idParamSchema,
  updateBankSchema,
  updateQuestionSchema,
} from './schema.js';
import { bankImportUpload } from './upload.js';

export const banksRouter = Router();

banksRouter.use(requireAuth, requireUser, withTenantContext);

banksRouter.get(
  '/',
  requireKindAccess('view', 'query'),
  validate({ query: bankListQuerySchema }),
  controller.list,
);
banksRouter.get(
  '/:id',
  requireOrgAccess('view'),
  validate({ params: idParamSchema }),
  controller.get,
);
banksRouter.post(
  '/',
  requireKindAccess('edit', 'body'),
  validate({ body: createBankSchema }),
  controller.create,
);
banksRouter.patch(
  '/:id',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema, body: updateBankSchema }),
  controller.update,
);
banksRouter.post(
  '/:id/questions',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema, body: createQuestionSchema }),
  controller.createQuestion,
);
banksRouter.post(
  '/:id/questions/bulk-status',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema, body: bulkQuestionStatusSchema }),
  controller.setQuestionsActive,
);
banksRouter.get(
  '/:id/questions/sample.xlsx',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema }),
  controller.sampleXlsx,
);
banksRouter.get(
  '/:id/questions/sample.csv',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema }),
  controller.sampleCsv,
);
banksRouter.get(
  '/:id/questions/export.xlsx',
  requireOrgAccess('view'),
  validate({ params: idParamSchema }),
  controller.exportXlsx,
);
banksRouter.get(
  '/:id/questions/export.csv',
  requireOrgAccess('view'),
  validate({ params: idParamSchema }),
  controller.exportCsv,
);
banksRouter.patch(
  '/:id/questions/:questionId',
  requireOrgAccess('edit'),
  validate({ params: bankQuestionParamsSchema, body: updateQuestionSchema }),
  controller.updateQuestion,
);
banksRouter.post(
  '/:id/import',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema }),
  bankImportUpload.single('file'),
  controller.importQuestions,
);
