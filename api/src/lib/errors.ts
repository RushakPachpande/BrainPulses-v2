export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: ErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function badRequest(message: string, fields?: Record<string, string>) {
  return new AppError(400, 'VALIDATION_ERROR', message, fields);
}

export function unauthorized(message = 'Authentication required.') {
  return new AppError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = 'You do not have permission to perform this action.') {
  return new AppError(403, 'FORBIDDEN', message);
}

export function notFound(message = 'Resource not found.') {
  return new AppError(404, 'NOT_FOUND', message);
}

export function conflict(message: string, fields?: Record<string, string>) {
  return new AppError(409, 'CONFLICT', message, fields);
}

export function unprocessable(message: string, fields?: Record<string, string>) {
  return new AppError(422, 'VALIDATION_ERROR', message, fields);
}
