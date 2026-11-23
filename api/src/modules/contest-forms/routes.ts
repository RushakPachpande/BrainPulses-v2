import { Router } from 'express';
import {
  requireAuth,
  requireUser,
  requireOrgAccess,
  requireRole,
  withTenantContext,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { confirmPasswordSchema } from '../../lib/verify-acting-password.js';
import * as controller from './controller.js';
import {
  contestQuizzesQuerySchema,
  giveQuizzesSchema,
  idParamSchema,
  imageParamSchema,
  registerSchema,
  saveFormSchema,
  slugParamSchema,
} from './schema.js';

export const contestFormsRouter = Router();

contestFormsRouter.use(requireAuth, requireUser, withTenantContext);

contestFormsRouter.get('/', requireOrgAccess('view'), controller.overview);
contestFormsRouter.get(
  '/quizzes',
  requireOrgAccess('view'),
  validate({ query: contestQuizzesQuerySchema }),
  controller.quizzes,
);
contestFormsRouter.get(
  '/:id/registrants',
  requireOrgAccess('view'),
  validate({ params: idParamSchema }),
  controller.registrants,
);
contestFormsRouter.get(
  '/:id',
  requireOrgAccess('view'),
  validate({ params: idParamSchema }),
  controller.get,
);
contestFormsRouter.post(
  '/',
  requireOrgAccess('edit'),
  validate({ body: saveFormSchema }),
  controller.create,
);
contestFormsRouter.patch(
  '/:id',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema, body: saveFormSchema }),
  controller.update,
);
contestFormsRouter.post(
  '/:id/regenerate-link',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema }),
  controller.regenerate,
);
contestFormsRouter.delete(
  '/:id',
  requireRole('super_admin'),
  validate({ params: idParamSchema, body: confirmPasswordSchema }),
  controller.remove,
);
contestFormsRouter.post(
  '/:id/quizzes',
  requireOrgAccess('edit'),
  validate({ params: idParamSchema, body: giveQuizzesSchema }),
  controller.give,
);

export const publicContestFormsRouter = Router();

publicContestFormsRouter.get(
  '/:slug/image/:which',
  validate({ params: imageParamSchema }),
  controller.publicImage,
);
publicContestFormsRouter.post(
  '/:slug/register',
  validate({ params: slugParamSchema, body: registerSchema }),
  controller.publicRegister,
);
publicContestFormsRouter.get('/:slug', validate({ params: slugParamSchema }), controller.publicGet);
