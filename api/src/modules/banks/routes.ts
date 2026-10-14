import { Router } from 'express';
import { requireAuth, requireUser, withTenantContext } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  bankListQuerySchema,
  bankQuestionParamsSchema,
  createBankSchema,
  createQuestionSchema,
  idParamSchema,
  importBodySchema,
  updateBankSchema,
  updateQuestionSchema,
} from './schema.js';

export const banksRouter = Router();

banksRouter.use(requireAuth, requireUser, withTenantContext);

banksRouter.get('/', validate({ query: bankListQuerySchema }), controller.list);
banksRouter.get('/:id', validate({ params: idParamSchema }), controller.get);
banksRouter.post('/', validate({ body: createBankSchema }), controller.create);
banksRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateBankSchema }),
  controller.update,
);
banksRouter.post(
  '/:id/questions',
  validate({ params: idParamSchema, body: createQuestionSchema }),
  controller.createQuestion,
);
banksRouter.patch(
  '/:id/questions/:questionId',
  validate({ params: bankQuestionParamsSchema, body: updateQuestionSchema }),
  controller.updateQuestion,
);
banksRouter.post(
  '/:id/import',
  validate({ params: idParamSchema, body: importBodySchema }),
  controller.importCsv,
);
