import { Router } from 'express';
import { requireAuth, requireStudent, requireUser } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  selectOrganizationSchema,
  signInSchema,
  studentRequestOtpSchema,
  studentResendOtpSchema,
  studentSignInByCodeSchema,
  studentVerifyOtpSchema,
} from './schema.js';

export const authRouter = Router();

authRouter.post('/sign-in', validate({ body: signInSchema }), controller.signIn);
authRouter.post(
  '/select-organization',
  validate({ body: selectOrganizationSchema }),
  controller.selectOrganization,
);
authRouter.post(
  '/student/sign-in-by-code',
  validate({ body: studentSignInByCodeSchema }),
  controller.studentSignInByCode,
);
authRouter.post(
  '/student/request-otp',
  validate({ body: studentRequestOtpSchema }),
  controller.studentRequestOtp,
);
authRouter.post(
  '/student/resend-otp',
  validate({ body: studentResendOtpSchema }),
  controller.studentResendOtp,
);
authRouter.post(
  '/student/verify-otp',
  validate({ body: studentVerifyOtpSchema }),
  controller.studentVerifyOtp,
);
authRouter.post(
  '/student/sign-out',
  requireAuth,
  requireStudent,
  controller.studentSignOut,
);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/sign-out', controller.signOut);
authRouter.get('/session', requireAuth, requireUser, controller.session);
