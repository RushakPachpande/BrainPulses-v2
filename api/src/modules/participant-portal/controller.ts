import type { NextFunction, Request, Response } from 'express';
import { participantActor } from '../../middleware/auth.js';
import { getParticipantPages } from '../../lib/participant-pages.js';
import * as service from './service.js';

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = participantActor(req);
    const data = await service.getMe(actor.organizationId, actor.participantId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function patchMe(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = participantActor(req);
    const data = await service.patchMe(actor.organizationId, actor.participantId, req.body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function pages(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = participantActor(req);
    const data = await getParticipantPages(actor.organizationId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function activities(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = participantActor(req);
    const data = await service.listMyActivities(
      actor.organizationId,
      actor.participantId,
      req.query as never,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function results(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = participantActor(req);
    const data = await service.listMyResults(
      actor.organizationId,
      actor.participantId,
      req.query as never,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function resultDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = participantActor(req);
    const data = await service.getMyResult(
      actor.organizationId,
      actor.participantId,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
