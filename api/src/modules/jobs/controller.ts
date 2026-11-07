import type { NextFunction, Request, Response } from 'express';
import { userActor } from '../../middleware/auth.js';
import * as service from './service.js';

export async function getJob(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const data = await service.getJobForActor(req.params.jobId as string, {
      userId: actor.userId,
      organizationId: actor.organizationId,
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function downloadExport(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = userActor(req);
    const file = await service.openExportDownload(req.params.jobId as string, {
      userId: actor.userId,
      organizationId: actor.organizationId,
    });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    file.stream.pipe(res);
  } catch (err) {
    next(err);
  }
}
