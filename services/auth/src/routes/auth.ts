import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { HANDLE_REGEX, MIN_PASSWORD_LENGTH } from '@ather/shared';
import type { Config } from '../config';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { ConflictError, type UserStore } from '../store';

const RegisterSchema = z.object({
  handle: z.string().regex(HANDLE_REGEX, 'invalid handle'),
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  displayName: z.string().min(1).max(80)
});

const LoginSchema = z.object({
  handleOrEmail: z.string().min(1),
  password: z.string().min(1)
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1)
});

export function buildAuthRouter(config: Config, store: UserStore): Router {
  const router = Router();

  // Rate limit auth endpoints to mitigate credential stuffing / brute force.
  // Production: replace the in-memory store with a Redis-backed one and key by
  // (IP, account) tuple. These limits are deliberately strict; tune from metrics.
  const isTest = config.NODE_ENV === 'test';
  const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isTest ? 1000 : 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { status: 429, code: 'rate_limited', detail: 'too many requests' }
  });
  const readLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: isTest ? 1000 : 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { status: 429, code: 'rate_limited', detail: 'too many requests' }
  });

  router.post('/register', writeLimiter, async (req, res, next) => {
    try {
      const input = RegisterSchema.parse(req.body);
      const passwordHash = await hashPassword(input.password);
      const user = await store.create({
        handle: input.handle,
        email: input.email,
        displayName: input.displayName,
        passwordHash
      });
      const tokens = await issueTokens(config, user.id, user.handle);
      res.status(201).json({
        user: toPublic(user),
        ...tokens
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', writeLimiter, async (req, res, next) => {
    try {
      const input = LoginSchema.parse(req.body);
      const user = await store.findByHandleOrEmail(input.handleOrEmail);
      if (!user || user.status !== 'active') {
        return unauthorized(res, 'invalid credentials');
      }
      const ok = await verifyPassword(input.password, user.passwordHash);
      if (!ok) {
        return unauthorized(res, 'invalid credentials');
      }
      const tokens = await issueTokens(config, user.id, user.handle);
      res.json({ user: toPublic(user), ...tokens });
    } catch (err) {
      next(err);
    }
  });

  router.post('/refresh', writeLimiter, async (req, res, next) => {
    try {
      const { refreshToken } = RefreshSchema.parse(req.body);
      let claims;
      try {
        claims = verifyRefreshToken(config, refreshToken);
      } catch {
        return unauthorized(res, 'invalid refresh token');
      }
      if (await store.isRefreshRevoked(claims.jti)) {
        return unauthorized(res, 'refresh token revoked');
      }
      const user = await store.findById(claims.sub);
      if (!user || user.status !== 'active') {
        return unauthorized(res, 'user not active');
      }
      // Single-use refresh: revoke the old one and issue a fresh pair.
      await store.revokeRefresh(claims.jti);
      const tokens = await issueTokens(config, user.id, user.handle);
      res.json(tokens);
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', writeLimiter, async (req, res, next) => {
    try {
      const { refreshToken } = RefreshSchema.parse(req.body);
      try {
        const claims = verifyRefreshToken(config, refreshToken);
        await store.revokeRefresh(claims.jti);
      } catch {
        // Ignore — logout is best-effort.
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', readLimiter, async (req, res, next) => {
    try {
      const auth = req.header('authorization');
      if (!auth || !auth.startsWith('Bearer ')) {
        return unauthorized(res, 'missing bearer token');
      }
      const token = auth.substring('Bearer '.length);
      let claims;
      try {
        claims = verifyAccessToken(config, token);
      } catch {
        return unauthorized(res, 'invalid access token');
      }
      const user = await store.findById(claims.sub);
      if (!user || user.status !== 'active') {
        return unauthorized(res, 'user not active');
      }
      res.json({ user: toPublic(user) });
    } catch (err) {
      next(err);
    }
  });

  // Local error handler for this router (zod + conflict).
  router.use(
    (err: unknown, _req: Request, res: Response, next: NextFunction): void => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          type: 'about:blank',
          title: 'Validation failed',
          status: 400,
          code: 'validation_failed',
          detail: err.flatten()
        });
        return;
      }
      if (err instanceof ConflictError) {
        res.status(409).json({
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          code: 'conflict',
          detail: err.message
        });
        return;
      }
      next(err);
    }
  );

  return router;
}

async function issueTokens(config: Config, userId: string, handle: string) {
  const accessToken = signAccessToken(config, { sub: userId, handle });
  const refreshToken = signRefreshToken(config, { sub: userId, jti: uuidv4() });
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer' as const,
    expiresIn: config.JWT_ACCESS_TTL_SECONDS
  };
}

function unauthorized(res: Response, detail: string) {
  return res.status(401).json({
    type: 'about:blank',
    title: 'Unauthorized',
    status: 401,
    code: 'unauthorized',
    detail
  });
}

function toPublic(user: {
  id: string;
  handle: string;
  displayName: string;
  createdAt: string;
}) {
  return {
    id: user.id,
    handle: user.handle,
    displayName: user.displayName,
    personaType: 'personal' as const,
    createdAt: user.createdAt
  };
}
