import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../lib/errors.js';
import * as service from './service.js';

export async function activityBoard(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.actor) throw unauthorized();
    const asStudent = req.actor.kind === 'student';
    const data = await service.getActivityLeaderboard(
      req.actor.organizationId,
      req.params.id as string,
      req.query as never,
      { asStudent },
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function orgBoard(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.actor) throw unauthorized();
    const asStudent = req.actor.kind === 'student';
    const data = await service.getOrgQuizLeaderboard(req.actor.organizationId, req.query as never, {
      asStudent,
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
