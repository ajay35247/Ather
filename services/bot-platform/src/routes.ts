import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  requireJwtSecret,
  ForbiddenError,
  NotFoundError
} from '@ather/service-kit';

export interface Bot {
  id: string;
  handle: string;
  ownerId: string;
  webhook: string;
  createdAt: string;
}

export class BotRegistry {
  private bots: Bot[] = [];
  register(input: Omit<Bot, 'id' | 'createdAt'>): Bot {
    if (this.bots.find((b) => b.handle === input.handle)) {
      throw new ForbiddenError('handle already taken');
    }
    const b: Bot = { id: uuidv4(), createdAt: new Date().toISOString(), ...input };
    this.bots.push(b);
    return b;
  }
  byHandle(handle: string): Bot {
    const b = this.bots.find((x) => x.handle === handle);
    if (!b) throw new NotFoundError('bot not found');
    return b;
  }
}

const RegisterSchema = z.object({
  handle: z.string().regex(/^[a-z0-9_]{3,32}$/),
  ownerId: z.string().min(1),
  /** Webhook must be https:// to prevent SSRF / cleartext transit. */
  webhook: z.string().url().refine((u) => u.startsWith('https://'), 'webhook must be https')
});

export function buildBotRouter(
  registry: BotRegistry,
  internalSecret: string,
  _jwtSecret: string,
  isTest: boolean
) {
  const limiters = defaultLimiters(isTest);
  const router = Router();

  router.post('/register', limiters.write, (req, res, next) => {
    if (req.header('x-internal-secret') !== internalSecret) {
      res.status(401).json({ status: 401, code: 'unauthorized' });
      return;
    }
    try {
      res.status(201).json({ bot: registry.register(RegisterSchema.parse(req.body)) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/by-handle/:handle', limiters.read, (req, res, next) => {
    try {
      res.json({ bot: registry.byHandle(String(req.params.handle)) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
