import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

function sealResponse(res: Response) {
  const ignore = () => res;
  res.json = ignore as Response['json'];
  res.send = ignore as Response['send'];
  res.end = ignore as Response['end'];
}

/**
 * Bounds how long an `/api` handler may run. Health routes are not mounted
 * under this middleware. Clears the timer when the response finishes.
 * A timed-out response is sealed so a late handler cannot write a second body.
 * The database statement timeout releases the connection; the socket stays up.
 */
export function armRequestTimeout(req: Request, res: Response, ms: number) {
  const timer = setTimeout(() => {
    if (res.headersSent) return;
    res.status(504).json({
      error: {
        code: 'REQUEST_TIMEOUT',
        message: 'The request took too long. Please try again.',
        requestId: req.requestId,
      },
    });
    sealResponse(res);
  }, ms);

  const clear = () => clearTimeout(timer);
  res.on('finish', clear);
  res.on('close', clear);
}

export function requestTimeout(req: Request, res: Response, next: NextFunction) {
  armRequestTimeout(req, res, env.REQUEST_TIMEOUT_MS);
  next();
}
