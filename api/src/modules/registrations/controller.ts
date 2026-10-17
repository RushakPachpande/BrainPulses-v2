import type { NextFunction, Request, Response } from 'express';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json(
      await service.listRegistrations(actor.organizationId, actor, req.query as never),
    );
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
      req.body.studentIds,
      req.header('idempotency-key') ?? undefined,
    );
    res.json({ data });
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
      req.body.studentIds,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function exportCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const csv = await service.exportCsv(
      actor.organizationId,
      actor,
      req.query.activityId as string,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="registrations.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
}
