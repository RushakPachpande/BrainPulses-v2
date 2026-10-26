import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  requireAuth,
  requireUser,
  requireOrgAccess,
  userActor,
  withTenantContext,
} from '../../middleware/auth.js';
import { env } from '../../config/env.js';
import { validate } from '../../middleware/validate.js';
import * as service from './service.js';

export const filesRouter = Router();

/** ASCII fallback + RFC 5987 UTF-8 filename* for non-Latin-1 / control chars. */
function contentDispositionAttachment(originalName: string): string {
  const cleaned = originalName.replace(/[\r\n\0]/g, '').trim() || 'download';
  const ascii = cleaned
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')
    .slice(0, 180);
  const fallback = ascii.length > 0 ? ascii : 'download';
  const encoded = encodeURIComponent(cleaned).replace(
    /['()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

const initiateSchema = z
  .object({
    originalName: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(120),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(
        Math.max(
          20 * 1024 * 1024,
          env.UPLOAD_IMAGE_SIZE_CAPPING || 10 * 1024 * 1024,
          env.QA_UPLOAD_IMAGE_SIZE_CAPPING || 5 * 1024 * 1024,
        ),
      ),
    purpose: z.enum(['catalog', 'question']).optional(),
  })
  .strict();

filesRouter.get('/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = String(req.query.token ?? req.header('x-download-token') ?? '');
    const { file, buffer } = await service.downloadWithToken(token);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', contentDispositionAttachment(file.originalName));
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

const inlineParams = z.object({ id: z.string().uuid() });

function sendInline(file: { mimeType: string }, buffer: Buffer, res: Response) {
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(buffer);
}

function allowImageRead(req: Request, res: Response, next: NextFunction) {
  if (req.actor?.kind === 'student') {
    next();
    return;
  }
  requireOrgAccess('view')(req, res, next);
}

filesRouter.get(
  '/:id',
  requireAuth,
  withTenantContext,
  allowImageRead,
  validate({ params: inlineParams }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.actor) return;
      const { file, buffer } = await service.readInlineImage(
        req.actor.organizationId,
        req.params.id as string,
      );
      sendInline(file, buffer, res);
    } catch (err) {
      next(err);
    }
  },
);

filesRouter.use(requireAuth, requireUser, withTenantContext);

filesRouter.post(
  '/initiate',
  requireOrgAccess('edit'),
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
  requireOrgAccess('edit'),
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
  requireOrgAccess('view'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = userActor(req);
      const data = await service.createDownloadToken(
        actor.organizationId,
        actor.userId,
        req.params.id as string,
        actor,
      );
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);
