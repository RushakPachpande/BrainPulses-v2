import type { NextFunction, Request, Response } from 'express';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json(await service.listResults(actor.organizationId, actor, req.query as never));
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json({
      data: await service.getResult(actor.organizationId, actor, req.params.id as string),
    });
  } catch (err) {
    next(err);
  }
}

export async function publish(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.publishResult(
      actor.organizationId,
      actor,
      req.params.id as string,
      req.header('idempotency-key') ?? undefined,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function regrade(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.regradeResult(
      actor.organizationId,
      actor,
      req.params.id as string,
      req.body,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.deleteResult(actor.organizationId, actor, req.params.id as string);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
