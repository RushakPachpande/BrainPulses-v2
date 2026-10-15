import type { NextFunction, Request, Response } from 'express';
import { userActor } from '../../middleware/auth.js';
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

export async function studentSignIn(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.studentSignIn(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
