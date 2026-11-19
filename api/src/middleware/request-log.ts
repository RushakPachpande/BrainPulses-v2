import type { NextFunction, Request, Response } from 'express';

function requestPath(req: Request): string {
  const routePath = req.route && typeof req.route.path === 'string' ? req.route.path : '';
  if (routePath) return `${req.baseUrl}${routePath}`;
  return (req.originalUrl.split('?')[0] ?? req.path) || req.path;
}

/** One completion line per API request. No body, token, or query string. */
export function requestLog(req: Request, res: Response, next: NextFunction) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
    console.log(
      JSON.stringify({
        msg: 'request',
        method: req.method,
        path: requestPath(req),
        status: res.statusCode,
        durationMs,
        requestId: req.requestId,
      }),
    );
  });
  next();
}
