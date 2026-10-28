import type { NextFunction, Request, Response } from 'express';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function disqualify(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.disqualifyAttempt(
      actor.organizationId,
      actor.userId,
      req.params.id as string,
      req.body?.note,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function requalify(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.requalifyAttempt(
      actor.organizationId,
      actor.userId,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function grantReattempt(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.grantReattempt(
      actor.organizationId,
      actor.userId,
      req.params.id as string,
      req.body.studentId,
      req.body.mode,
      req.body.note,
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listReattempts(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.listReattemptGrants(actor.organizationId, req.params.id as string);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.deleteAttemptAdmin(
      actor.organizationId,
      actor,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
