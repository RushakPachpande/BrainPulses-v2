import type { NextFunction, Request, Response } from 'express';
import { verifyActingUserPassword } from '../../lib/verify-acting-password.js';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.listSponsors(actor.organizationId, req.query as never);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.getSponsor(actor.organizationId, req.params.id as string);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.createSponsor(actor.organizationId, actor.userId, req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.updateSponsor(
      actor.organizationId,
      actor.userId,
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
    await verifyActingUserPassword(actor.userId, req.body.password as string);
    const data = await service.deleteSponsor(
      actor.organizationId,
      actor.userId,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
