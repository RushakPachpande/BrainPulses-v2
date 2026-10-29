import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  requireAuth,
  requireUser,
  requireOrgAccess,
  userActor,
  withTenantContext,
} from '../../middleware/auth.js';
import { getDashboardSummary } from './service.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requireUser, withTenantContext);

dashboardRouter.get(
  '/summary',
  requireOrgAccess('view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = userActor(req);
      const data = await getDashboardSummary(actor.organizationId);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);
