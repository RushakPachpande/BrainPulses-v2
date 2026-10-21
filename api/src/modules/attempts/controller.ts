import type { NextFunction, Request, Response } from 'express';
import { studentActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function start(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = studentActor(req);
    const data = await service.startAttempt(
      actor.organizationId,
      actor.studentId,
      req.body.activityId,
      req.body.roundId,
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function resume(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = studentActor(req);
    const data = await service.resumeAttempt(
      actor.organizationId,
      actor.studentId,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function save(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = studentActor(req);
    const data = await service.saveAttempt(
      actor.organizationId,
      actor.studentId,
      req.params.id as string,
      req.body,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = studentActor(req);
    const data = await service.submitAttempt(
      actor.organizationId,
      actor.studentId,
      req.params.id as string,
      req.header('idempotency-key') ?? undefined,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
