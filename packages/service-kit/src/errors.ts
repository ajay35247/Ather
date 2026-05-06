import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
    this.name = 'HttpError';
  }
}

export class NotFoundError extends HttpError {
  constructor(detail = 'not found') {
    super(404, 'not_found', detail);
  }
}

export class ConflictError extends HttpError {
  constructor(detail: string) {
    super(409, 'conflict', detail);
  }
}

export class ForbiddenError extends HttpError {
  constructor(detail = 'forbidden') {
    super(403, 'forbidden', detail);
  }
}

export class ValidationError extends HttpError {
  constructor(public details: unknown) {
    super(400, 'validation_failed', 'validation failed');
  }
}

/** Express error handler that produces RFC 7807-style problem responses. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      type: 'about:blank',
      title: 'Validation failed',
      status: 400,
      code: 'validation_failed',
      detail: err.flatten()
    });
    return;
  }
  if (err instanceof ValidationError) {
    res.status(400).json({
      type: 'about:blank',
      title: 'Validation failed',
      status: 400,
      code: err.code,
      detail: err.details
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({
      type: 'about:blank',
      title: err.message,
      status: err.status,
      code: err.code,
      detail: err.message
    });
    return;
  }
  // eslint-disable-next-line no-console
  console.error('unhandled error', err);
  res.status(500).json({
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    code: 'internal_error'
  });
}
