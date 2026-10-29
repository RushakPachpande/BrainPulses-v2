import { Router } from 'express';
import { requireAuth, requireStudent, withTenantContext } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { idParamSchema, saveAttemptSchema, startAttemptSchema } from './schema.js';

export const attemptsRouter = Router();

attemptsRouter.use(requireAuth, requireStudent, withTenantContext);

attemptsRouter.post('/start', validate({ body: startAttemptSchema }), controller.start);
attemptsRouter.get('/:id/resume', validate({ params: idParamSchema }), controller.resume);
attemptsRouter.post(
  '/:id/save',
  validate({ params: idParamSchema, body: saveAttemptSchema }),
  controller.save,
);
attemptsRouter.post('/:id/advance', validate({ params: idParamSchema }), controller.advance);
attemptsRouter.post('/:id/submit', validate({ params: idParamSchema }), controller.submit);
