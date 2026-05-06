import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest,
  ForbiddenError,
  NotFoundError
} from '@ather/service-kit';

export interface LiveSession {
  id: string;
  hostId: string;
  title: string;
  status: 'live' | 'ended';
  startedAt: string;
  endedAt?: string;
  viewers: number;
}

export class LiveStore {
  private items: LiveSession[] = [];
  start(hostId: string, title: string): LiveSession {
    const s: LiveSession = {
      id: uuidv4(),
      hostId,
      title,
      status: 'live',
      startedAt: new Date().toISOString(),
      viewers: 0
    };
    this.items.push(s);
    return s;
  }
  end(id: string, by: string): LiveSession {
    const s = this.items.find((x) => x.id === id);
    if (!s) throw new NotFoundError('session not found');
    if (s.hostId !== by) throw new ForbiddenError('not host');
    s.status = 'ended';
    s.endedAt = new Date().toISOString();
    return s;
  }
  active(): LiveSession[] {
    return this.items.filter((s) => s.status === 'live');
  }
}

const StartSchema = z.object({ title: z.string().min(1).max(200) });

export function buildLiveRouter(store: LiveStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/start', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const { title } = StartSchema.parse(req.body);
      res.status(201).json({ session: store.start(req.claims!.sub, title) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/end', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      res.json({ session: store.end(String(req.params.id), req.claims!.sub) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/active', limiters.read, (_req, res) => {
    res.json({ items: store.active() });
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
