import type { NextFunction, Request, Response } from 'express';
import { participantActor, userActor } from '../../middleware/auth.js';
import * as authService from './service.js';

export async function signIn(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signIn(req.body, res);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function selectOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.selectOrganization(req.body, res);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.refresh(
      req.cookies as Record<string, string | undefined>,
      res,
    );
    if (!result) {
      res.status(204).end();
      return;
    }
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function signOut(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signOut(
      req.cookies as Record<string, string | undefined>,
      res,
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function session(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const result = await authService.getSession(actor);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const result = await authService.changeOwnPassword(actor, req.body, res);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function participantLoginOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const slug =
      typeof req.query.organizationSlug === 'string' ? req.query.organizationSlug : undefined;
    const result = await authService.participantLoginOptions(slug);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function participantSignInByCode(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.participantSignInByCode(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function participantRequestOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.participantRequestOtp(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function participantResendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.participantResendOtp(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function participantVerifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.participantVerifyOtp(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function participantSignOut(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = participantActor(req);
    const result = await authService.participantSignOutSession(actor);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
