import type { NextFunction, Request, Response } from 'express';
import { badRequest } from '../../lib/errors.js';
import { verifyActingUserPassword } from '../../lib/verify-acting-password.js';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.listParticipants(actor.organizationId, req.query as never);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.getParticipant(actor.organizationId, req.params.id as string);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.createParticipant(actor.organizationId, actor.userId, req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.updateParticipant(
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
    const data = await service.deactivateParticipant(
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
    const data = await service.deactivateParticipants(
      actor.organizationId,
      actor.userId,
      req.body.ids,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function activateMany(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.activateParticipants(
      actor.organizationId,
      actor.userId,
      req.body.ids,
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
    const data = await service.deleteParticipant(
      actor.organizationId,
      actor.userId,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function sampleXlsx(req: Request, res: Response, next: NextFunction) {
  try {
    const buffer = await service.sampleParticipantsWorkbook();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="brainpulses-participants-sample.xlsx"',
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function importFile(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const file = req.file;
    if (!file) {
      throw badRequest(
        'Upload an Excel (.xlsx) file in the multipart field “file”. Download Sample Excel for the correct template.',
      );
    }
    const data = await service.importParticipantsFile(actor.organizationId, actor.userId, {
      buffer: file.buffer,
      originalname: file.originalname,
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
