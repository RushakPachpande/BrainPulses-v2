import type { NextFunction, Request, Response } from 'express';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json(await service.listActivities(actor.organizationId, req.query as never));
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json({ data: await service.getActivity(actor.organizationId, req.params.id as string) });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.createActivity(actor.organizationId, actor.userId, actor, req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.updateActivity(
      actor.organizationId,
      actor.userId,
      actor,
      req.params.id as string,
      req.body,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function publish(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.publishActivity(
      actor.organizationId,
      actor.userId,
      actor,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function archive(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.archiveActivity(
      actor.organizationId,
      actor.userId,
      actor,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
