import type { NextFunction, Request, Response } from 'express';
import { badRequest } from '../../lib/errors.js';
import { verifyActingUserPassword } from '../../lib/verify-acting-password.js';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json(await service.listUsers(actor.organizationId, req.query as never));
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    res.json({
      data: await service.getMembership(actor.organizationId, req.params.id as string),
    });
  } catch (err) {
    next(err);
  }
}

export async function invite(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.inviteUser(actor.organizationId, actor.userId, actor.role, req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.updateMembership(
      actor.organizationId,
      actor.userId,
      actor.role,
      req.params.id as string,
      req.body,
      {
        assessmentAccess: actor.assessmentAccess,
        quizAccess: actor.quizAccess,
      },
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.deactivateMembership(
      actor.organizationId,
      actor.userId,
      actor.role,
      req.params.id as string,
      {
        assessmentAccess: actor.assessmentAccess,
        quizAccess: actor.quizAccess,
      },
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
    const data = await service.deleteUserCompletely(
      actor.organizationId,
      actor.userId,
      actor.role,
      req.params.id as string,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.resetMembershipPassword(
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

export async function sampleXlsx(req: Request, res: Response, next: NextFunction) {
  try {
    const buffer = await service.sampleUsersWorkbook();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="brainpulses-users-sample.xlsx"');
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
    const { randomUUID } = await import('node:crypto');
    const { enqueueJob } = await import('../../lib/queue/queues.js');
    const { writeImportTempFile } = await import('../../lib/queue/processors.js');
    const jobKey = randomUUID();
    const tempPath = await writeImportTempFile(jobKey, file.originalname, file.buffer);
    const enqueued = await enqueueJob('import.users', {
      type: 'import.users',
      organizationId: actor.organizationId,
      userId: actor.userId,
      actor: {
        role: actor.role,
        assessmentAccess: actor.assessmentAccess,
        quizAccess: actor.quizAccess,
      },
      tempPath,
      originalname: file.originalname,
      requestId: req.requestId,
    });
    if (enqueued.status === 'completed' && enqueued.result?.kind === 'import') {
      res.json({ data: enqueued.result.data });
      return;
    }
    res.status(202).json({
      data: { jobId: enqueued.jobId, status: 'queued' },
    });
  } catch (err) {
    next(err);
  }
}
