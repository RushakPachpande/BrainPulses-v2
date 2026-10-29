import type { NextFunction, Request, Response } from 'express';
import { studentActor, userActor } from '../../middleware/auth.js';
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

export async function studentSignInByCode(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.studentSignInByCode(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function studentRequestOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.studentRequestOtp(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function studentResendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.studentResendOtp(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function studentVerifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.studentVerifyOtp(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function studentSignOut(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = studentActor(req);
    const result = await authService.studentSignOutSession(actor);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
