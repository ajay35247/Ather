import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Config } from '../config';
import { verifyAccessToken, type AccessClaims } from '../lib/jwt';
import type { ProfileStore } from '../store';

const UpdateSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().max(2048).optional()
});

interface AuthedRequest extends Request {
  claims?: AccessClaims;
}

function requireAuth(config: Config) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const auth = req.header('authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ status: 401, code: 'unauthorized', detail: 'missing bearer token' });
      return;
    }
    try {
      req.claims = verifyAccessToken(config, auth.substring('Bearer '.length));
      next();
    } catch {
      res.status(401).json({ status: 401, code: 'unauthorized', detail: 'invalid access token' });
    }
  };
}

export function buildProfileRouter(config: Config, store: ProfileStore): Router {
  const router = Router();

  const isTest = config.NODE_ENV === 'test';
  const readLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: isTest ? 1000 : 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { status: 429, code: 'rate_limited', detail: 'too many requests' }
  });
  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: isTest ? 1000 : 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { status: 429, code: 'rate_limited', detail: 'too many requests' }
  });

  router.get('/me', readLimiter, requireAuth(config), async (req: AuthedRequest, res, next) => {
    try {
      const claims = req.claims!;
      let profile = await store.getByUserId(claims.sub);
      if (!profile) {
        // Phase 0: lazily project the profile from token claims so the API is usable
        // before we wire the auth -> profile event flow. Phase 1 replaces this with
        // a Kafka consumer of `user.created`.
        profile = await store.upsert({
          userId: claims.sub,
          handle: claims.handle,
          displayName: claims.handle,
          personaType: 'personal'
        });
      }
      res.json({ profile });
    } catch (err) {
      next(err);
    }
  });

  router.get('/by-handle/:handle', readLimiter, async (req, res, next) => {
    try {
      const handle = String(req.params.handle ?? '').trim();
      if (!handle) {
        res.status(400).json({ status: 400, code: 'bad_request' });
        return;
      }
      const profile = await store.getByHandle(handle);
      if (!profile) {
        res.status(404).json({ status: 404, code: 'not_found' });
        return;
      }
      res.json({ profile });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/me', writeLimiter, requireAuth(config), async (req: AuthedRequest, res, next) => {
    try {
      const patch = UpdateSchema.parse(req.body);
      const claims = req.claims!;
      // Ensure the profile row exists (lazy projection — see /me above).
      const existing = await store.getByUserId(claims.sub);
      if (!existing) {
        await store.upsert({
          userId: claims.sub,
          handle: claims.handle,
          displayName: claims.handle,
          personaType: 'personal'
        });
      }
      const updated = await store.update(claims.sub, patch);
      res.json({ profile: updated });
    } catch (err) {
      next(err);
    }
  });

  router.use((err: unknown, _req: Request, res: Response, next: NextFunction): void => {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        status: 400,
        code: 'validation_failed',
        detail: err.flatten()
      });
      return;
    }
    next(err);
  });

  return router;
}
