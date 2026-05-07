import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  paginateNewestFirst,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest,
  ForbiddenError,
  NotFoundError
} from '@ather/service-kit';

export interface NotificationRecord {
  id: string;
  userId: string;
  kind: string;
  payload: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

export class NotificationStore {
  private items: NotificationRecord[] = [];

  push(input: { userId: string; kind: string; payload: Record<string, unknown> }): NotificationRecord {
    const rec: NotificationRecord = {
      id: uuidv4(),
      userId: input.userId,
      kind: input.kind,
      payload: input.payload,
      createdAt: new Date().toISOString()
    };
    this.items.push(rec);
    return rec;
  }

  forUser(userId: string): NotificationRecord[] {
    return this.items.filter((n) => n.userId === userId);
  }

  markRead(id: string, by: string): NotificationRecord {
    const n = this.items.find((x) => x.id === id);
    if (!n) throw new NotFoundError('notification not found');
    if (n.userId !== by) throw new ForbiddenError('not owner');
    if (!n.readAt) n.readAt = new Date().toISOString();
    return n;
  }

  unreadCount(userId: string): number {
    return this.items.filter((n) => n.userId === userId && !n.readAt).length;
  }
}

const PushSchema = z.object({
  userId: z.string().min(1),
  kind: z.string().regex(/^[a-z._-]{1,64}$/),
  payload: z.record(z.unknown()).optional()
});

export function buildNotificationRouter(
  store: NotificationStore,
  jwtSecret: string,
  isTest: boolean,
  internalSecret: string | null
) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  // Internal-only: other services push notifications using a shared secret.
  router.post('/internal/push', limiters.write, (req, res, next) => {
    if (!internalSecret || req.header('x-internal-secret') !== internalSecret) {
      res.status(401).json({ status: 401, code: 'unauthorized' });
      return;
    }
    try {
      const input = PushSchema.parse(req.body);
      const rec = store.push({
        userId: input.userId,
        kind: input.kind,
        payload: input.payload ?? {}
      });
      res.status(201).json({ notification: rec });
    } catch (err) {
      next(err);
    }
  });

  router.get('/', limiters.read, auth, (req: AuthedRequest, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const all = store.forUser(req.claims!.sub);
    res.json(paginateNewestFirst(all, cursor, limit));
  });

  router.get('/unread-count', limiters.read, auth, (req: AuthedRequest, res) => {
    res.json({ count: store.unreadCount(req.claims!.sub) });
  });

  router.patch('/:id/read', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const n = store.markRead(String(req.params.id), req.claims!.sub);
      res.json({ notification: n });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
