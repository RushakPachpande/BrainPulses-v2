import type { NextFunction, Request, Response } from 'express';
import { studentActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = studentActor(req);
    const data = await service.getMe(actor.organizationId, actor.studentId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function patchMe(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = studentActor(req);
    const data = await service.patchMe(actor.organizationId, actor.studentId, req.body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function activities(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = studentActor(req);
    const data = await service.listMyActivities(
      actor.organizationId,
      actor.studentId,
      req.query as never,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function results(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = studentActor(req);
    const data = await service.listMyResults(
      actor.organizationId,
      actor.studentId,
      req.query as never,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function resultDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = studentActor(req);
    const data = await service.getMyResult(
      actor.organizationId,
      actor.studentId,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
