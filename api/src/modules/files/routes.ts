import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireUser, userActor, withTenantContext } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './service.js';

export const filesRouter = Router();

const initiateSchema = z.object({
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive(),
});

filesRouter.get('/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = String(req.query.token ?? '');
    const { file, buffer } = await service.downloadWithToken(token);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.originalName.replace(/"/g, '')}"`,
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

filesRouter.use(requireAuth, requireUser, withTenantContext);

filesRouter.post(
  '/initiate',
  validate({ body: initiateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = userActor(req);
      const data = await service.initiateUpload(actor.organizationId, actor.userId, req.body);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

filesRouter.put(
  '/:id/content',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = userActor(req);
      const data = await service.finalizeUpload(
        actor.organizationId,
        actor.userId,
        req.params.id as string,
        req,
      );
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

filesRouter.post(
  '/:id/download-token',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = userActor(req);
      const data = await service.createDownloadToken(
        actor.organizationId,
        actor.userId,
        req.params.id as string,
      );
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);
