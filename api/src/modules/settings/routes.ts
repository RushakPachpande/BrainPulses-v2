import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  requireAuth,
  requireUser,
  requireOrgAccess,
  userActor,
  withTenantContext,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { groupParamSchema, patchSettingsSchema } from './schema.js';
import * as service from './service.js';

export const settingsRouter = Router();

settingsRouter.use(requireAuth, requireUser, withTenantContext);

settingsRouter.get(
  '/:group',
  requireOrgAccess('view'),
  validate({ params: groupParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = userActor(req);
      const data = await service.getSettings(actor.organizationId, req.params.group as 'general');
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

settingsRouter.patch(
  '/:group',
  requireOrgAccess('full'),
  validate({ params: groupParamSchema, body: patchSettingsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = userActor(req);
      const data = await service.patchSettings(
        actor.organizationId,
        actor.userId,
        req.params.group as 'general',
        req.body.values,
      );
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);
