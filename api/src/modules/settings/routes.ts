import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { requireAuth, requireUser, userActor, withTenantContext } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { groupParamSchema, patchSettingsSchema } from './schema.js';
import * as service from './service.js';

export const settingsRouter = Router();

settingsRouter.use(requireAuth, requireUser, withTenantContext);

settingsRouter.get(
  '/:group',
  validate({ params: groupParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = userActor(req);
      const data = await service.getSettings(
        actor.organizationId,
        req.params.group as 'general' | 'access' | 'notifications' | 'system',
      );
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

settingsRouter.patch(
  '/:group',
  validate({ params: groupParamSchema, body: patchSettingsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = userActor(req);
      const data = await service.patchSettings(
        actor.organizationId,
        actor.userId,
        req.params.group as 'general' | 'access' | 'notifications' | 'system',
        req.body.values,
      );
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);
