import type { NextFunction, Request, Response } from 'express';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';
import type { SaveFormInput } from './schema.js';

export async function overview(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.listOverview(actor.organizationId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function quizzes(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.listContestQuizzes(
      actor.organizationId,
      String(req.query.contestId),
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.getForm(actor.organizationId, req.params.id as string);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.createForm(
      actor.organizationId,
      actor.userId,
      req.body as SaveFormInput,
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.updateForm(
      actor.organizationId,
      actor.userId,
      req.params.id as string,
      req.body as SaveFormInput,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function verifyPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.verifyPassword(actor.userId, req.body.password as string);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function regenerate(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.regenerateLink(
      actor.organizationId,
      actor.userId,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function give(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.giveQuizzes(
      actor.organizationId,
      actor.userId,
      req.params.id as string,
      req.body.activityIds as string[],
      req.body.emailOnQuiz as boolean | undefined,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function publicGet(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.publicForm(req.params.slug as string);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function publicImage(req: Request, res: Response, next: NextFunction) {
  try {
    const which = req.params.which === 'sponsor' ? 'sponsor' : 'contest';
    const { file, buffer } = await service.publicImage(req.params.slug as string, which);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function publicRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.register(
      req.params.slug as string,
      req.body.answers as Record<string, string | string[] | boolean>,
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}
