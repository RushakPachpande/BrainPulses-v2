import type { NextFunction, Request, Response } from 'express';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json(await service.listUsers(actor.organizationId, req.query as never));
  } catch (err) {
    next(err);
  }
}

export async function invite(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.inviteUser(actor.organizationId, actor.userId, actor.role, req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.updateMembership(
      actor.organizationId,
      actor.userId,
      actor.role,
      req.params.id as string,
      req.body,
      {
        assessmentAccess: actor.assessmentAccess,
        quizAccess: actor.quizAccess,
      },
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.deactivateMembership(
      actor.organizationId,
      actor.userId,
      actor.role,
      req.params.id as string,
      {
        assessmentAccess: actor.assessmentAccess,
        quizAccess: actor.quizAccess,
      },
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
