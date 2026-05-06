import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createError } from './errorHandler';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(createError('Unauthorized', 401));
  }

  const token = header.slice(7);
  try {
    const secret = requireJwtSecret();
    const payload = jwt.verify(token, secret) as { userId: string; email: string };
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    next(createError('Invalid or expired token', 401));
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }

  const token = header.slice(7);
  try {
    const secret = requireJwtSecret();
    const payload = jwt.verify(token, secret) as { userId: string; email: string };
    req.userId = payload.userId;
    req.userEmail = payload.email;
  } catch {
    // ignore
  }
  next();
}

/** Returns JWT_SECRET. Falls back to a dev-only value; throws in production if unset. */
export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    return 'ather-secret-dev-only-do-not-use-in-production';
  }
  return secret;
}
