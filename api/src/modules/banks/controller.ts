import type { NextFunction, Request, Response } from 'express';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json(await service.listBanks(actor.organizationId, req.query as never));
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json({ data: await service.getBank(actor.organizationId, req.params.id as string) });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.createBank(actor.organizationId, actor.userId, req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.updateBank(
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

export async function createQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.createQuestion(
      actor.organizationId,
      actor.userId,
      req.params.id as string,
      req.body,
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.updateQuestion(
      actor.organizationId,
      actor.userId,
      req.params.id as string,
      req.params.questionId as string,
      req.body,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function importCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.importQuestions(
      actor.organizationId,
      actor.userId,
      req.params.id as string,
      req.body.csv,
      req.header('idempotency-key') ?? undefined,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
