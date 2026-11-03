import { Router } from 'express';
import { requireAuth, requireParticipant, requireUser } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  changePasswordSchema,
  selectOrganizationSchema,
  signInSchema,
  participantRequestOtpSchema,
  participantResendOtpSchema,
  participantSignInByCodeSchema,
  participantVerifyOtpSchema,
} from './schema.js';

export const authRouter = Router();

authRouter.post('/sign-in', validate({ body: signInSchema }), controller.signIn);
authRouter.post(
  '/select-organization',
  validate({ body: selectOrganizationSchema }),
  controller.selectOrganization,
);
authRouter.get('/participant/login-options', controller.participantLoginOptions);
authRouter.post(
  '/participant/sign-in-by-code',
  validate({ body: participantSignInByCodeSchema }),
  controller.participantSignInByCode,
);
authRouter.post(
  '/participant/request-otp',
  validate({ body: participantRequestOtpSchema }),
  controller.participantRequestOtp,
);
authRouter.post(
  '/participant/resend-otp',
  validate({ body: participantResendOtpSchema }),
  controller.participantResendOtp,
);
authRouter.post(
  '/participant/verify-otp',
  validate({ body: participantVerifyOtpSchema }),
  controller.participantVerifyOtp,
);
authRouter.post(
  '/participant/sign-out',
  requireAuth,
  requireParticipant,
  controller.participantSignOut,
);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/sign-out', controller.signOut);
authRouter.get('/session', requireAuth, requireUser, controller.session);
authRouter.post(
  '/password',
  requireAuth,
  requireUser,
  validate({ body: changePasswordSchema }),
  controller.changePassword,
);
