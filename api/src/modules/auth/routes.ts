import { Router } from 'express';
import { requireAuth, requireUser } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { selectOrganizationSchema, signInSchema, studentSignInSchema } from './schema.js';

export const authRouter = Router();

authRouter.post('/sign-in', validate({ body: signInSchema }), controller.signIn);
authRouter.post(
  '/select-organization',
  validate({ body: selectOrganizationSchema }),
  controller.selectOrganization,
);
authRouter.post(
  '/student/sign-in',
  validate({ body: studentSignInSchema }),
  controller.studentSignIn,
);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/sign-out', controller.signOut);
authRouter.get('/session', requireAuth, requireUser, controller.session);
