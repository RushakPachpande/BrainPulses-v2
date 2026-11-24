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
  fieldImageParamSchema,
  giveQuizzesSchema,
  idParamSchema,
  imageParamSchema,
  registerSchema,
  registrantParamSchema,
  saveFormSchema,
  slugParamSchema,
  updateRegistrantSchema,
} from './schema.js';

export const contestFormsRouter = Router();

contestFormsRouter.use(requireAuth, requireUser, withTenantContext);

contestFormsRouter.get('/', requireOrgAccess('view'), controller.overview);
/** Asks for the admin's own password before editing a saved form or unlocking contact fields. */
contestFormsRouter.post(
  '/confirm-password',
  requireOrgAccess('edit'),
  validate({ body: confirmPasswordSchema }),
  controller.confirmPassword,
);
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
  '/:id/registrants/:submissionId',
  requireOrgAccess('view'),
  validate({ params: registrantParamSchema }),
  controller.registrant,
);
contestFormsRouter.patch(
  '/:id/registrants/:submissionId',
  requireOrgAccess('edit'),
  validate({ params: registrantParamSchema, body: updateRegistrantSchema }),
  controller.updateRegistrant,
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
publicContestFormsRouter.get(
  '/:slug/fields/:fieldId/image',
  validate({ params: fieldImageParamSchema }),
  controller.publicFieldImage,
);
publicContestFormsRouter.post(
  '/:slug/register',
  validate({ params: slugParamSchema, body: registerSchema }),
  controller.publicRegister,
);
publicContestFormsRouter.get('/:slug', validate({ params: slugParamSchema }), controller.publicGet);
