import { Router } from 'express';
import { requireAuth, requireUser, withTenantContext } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { idParamSchema, regradeSchema, resultListQuerySchema } from './schema.js';

export const resultsRouter = Router();

resultsRouter.use(requireAuth, requireUser, withTenantContext);

resultsRouter.get('/', validate({ query: resultListQuerySchema }), controller.list);
resultsRouter.get('/:id', validate({ params: idParamSchema }), controller.get);
resultsRouter.post('/:id/publish', validate({ params: idParamSchema }), controller.publish);
resultsRouter.post(
  '/:id/regrade',
  validate({ params: idParamSchema, body: regradeSchema }),
  controller.regrade,
);
