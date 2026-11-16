import type { NextFunction, Request, Response } from 'express';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json(await service.listRegistrations(actor.organizationId, actor, req.query as never));
  } catch (err) {
    next(err);
  }
}

export async function assignable(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.listAssignable(
      actor.organizationId,
      actor,
      String(req.query.activityId),
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function assign(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.assign(
      actor.organizationId,
      actor,
      req.body.activityId,
      req.body.participantIds,
      req.header('idempotency-key') ?? undefined,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createManual(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.createManual(actor.organizationId, actor, req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function unassign(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.unassign(
      actor.organizationId,
      actor,
      req.body.activityId,
      req.body.participantIds,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
