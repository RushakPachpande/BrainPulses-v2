import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

/**
 * Bounds how long an `/api` handler may run. Health routes are not mounted
 * under this middleware. Clears the timer when the response finishes.
 */
export function requestTimeout(req: Request, res: Response, next: NextFunction) {
  const ms = env.REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => {
    if (res.headersSent) return;
    res.status(504).json({
      error: {
        code: 'REQUEST_TIMEOUT',
        message: 'The request took too long. Please try again.',
        requestId: req.requestId,
      },
    });
    if (!req.socket.destroyed) {
      req.socket.destroy();
    }
  }, ms);

  const clear = () => clearTimeout(timer);
  res.on('finish', clear);
  res.on('close', clear);
  next();
}
