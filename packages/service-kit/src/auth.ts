import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

export interface AccessClaims {
  sub: string;
  handle: string;
  type: 'access';
}

export interface AuthedRequest extends Request {
  claims?: AccessClaims;
}

export function verifyAccessToken(secret: string, token: string): AccessClaims {
  const decoded = jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: 'ather.auth'
  });
  if (typeof decoded === 'string' || (decoded as AccessClaims).type !== 'access') {
    throw new Error('Invalid access token');
  }
  return decoded as AccessClaims;
}

/**
 * Express middleware that requires `Authorization: Bearer <jwt>` and attaches
 * decoded claims to `req.claims`.
 */
export function requireBearerAuth(jwtSecret: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const auth = req.header('authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      res
        .status(401)
        .json({ status: 401, code: 'unauthorized', detail: 'missing bearer token' });
      return;
    }
    try {
      req.claims = verifyAccessToken(jwtSecret, auth.substring('Bearer '.length));
      next();
    } catch {
      res
        .status(401)
        .json({ status: 401, code: 'unauthorized', detail: 'invalid access token' });
    }
  };
}

/**
 * Reads a JWT secret from env. In production refuses to start if unset or default.
 */
export function requireJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_ACCESS_SECRET;
  if (!secret) {
    if (env.NODE_ENV === 'production') {
      throw new Error('JWT_ACCESS_SECRET must be set in production');
    }
    return 'dev-only-change-me-access-secret';
  }
  if (env.NODE_ENV === 'production' && secret.startsWith('dev-only')) {
    throw new Error('Refusing to start in production with default JWT secret');
  }
  return secret;
}
