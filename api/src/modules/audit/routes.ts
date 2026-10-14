import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  requireAuth,
  requireRole,
  requireUser,
  userActor,
  withTenantContext,
} from '../../middleware/auth.js';
import { notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, listQuerySchema } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';

export const auditRouter = Router();

auditRouter.use(requireAuth, requireUser, requireRole('super_admin'), withTenantContext);

const listSchema = listQuerySchema.extend({
  action: z.string().optional(),
});

auditRouter.get(
  '/',
  validate({ query: listSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = userActor(req);
      const query = req.query as unknown as z.infer<typeof listSchema>;
      const where = {
        organizationId: actor.organizationId,
        ...(query.action ? { action: query.action } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      };
      const [total, rows] = await Promise.all([
        prisma.auditEvent.count({
          where: {
            organizationId: actor.organizationId,
            ...(query.action ? { action: query.action } : {}),
          },
        }),
        prisma.auditEvent.findMany({
          where,
          include: { actorUser: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          take: query.limit + 1,
        }),
      ]);
      const { items, page } = buildPage(rows, query.limit, total);
      res.json(
        listEnvelope(
          items.map((e) => ({
            id: e.id,
            action: e.action,
            actorType: e.actorType,
            actor: e.actorUser?.name ?? e.actorType,
            targetType: e.targetType,
            targetId: e.targetId,
            createdAt: e.createdAt,
          })),
          page,
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

auditRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = userActor(req);
      const event = await prisma.auditEvent.findFirst({
        where: { organizationId: actor.organizationId, id: req.params.id as string },
        include: { actorUser: { select: { name: true, email: true } } },
      });
      if (!event) throw notFound('Audit event not found.');
      res.json({ data: event });
    } catch (err) {
      next(err);
    }
  },
);
