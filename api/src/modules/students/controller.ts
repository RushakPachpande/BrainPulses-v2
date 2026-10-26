import type { NextFunction, Request, Response } from 'express';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.listStudents(actor.organizationId, req.query as never);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.getStudent(actor.organizationId, req.params.id as string);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.createStudent(actor.organizationId, actor.userId, req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.updateStudent(
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

export async function deactivate(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.deactivateStudent(
      actor.organizationId,
      actor.userId,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function deactivateMany(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.deactivateStudents(actor.organizationId, actor.userId, req.body.ids);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function activateMany(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.activateStudents(actor.organizationId, actor.userId, req.body.ids);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
