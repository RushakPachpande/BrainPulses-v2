import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

function isBodyParserError(
  err: unknown,
): err is Error & { type?: string; status?: number; statusCode?: number } {
  return Boolean(err && typeof err === 'object' && 'type' in err);
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        requestId: req.requestId,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] = issue.message;
    }
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request contains invalid fields.',
        requestId: req.requestId,
        fields,
      },
    });
    return;
  }

  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body could not be parsed as JSON.',
          requestId: req.requestId,
        },
      });
      return;
    }
    if (err.type === 'entity.too.large') {
      res.status(413).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body is too large.',
          requestId: req.requestId,
        },
      });
      return;
    }
  }

  console.error('[api]', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId: req.requestId,
    },
  });
}
