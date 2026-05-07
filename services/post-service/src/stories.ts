import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  requireBearerAuth,
  type AuthedRequest
} from '@ather/service-kit';

export interface Story {
  id: string;
  authorId: string;
  mediaId: string;
  createdAt: string;
  expiresAt: string;
}

export class StoryStore {
  private items: Story[] = [];
  /** Ephemeral by design: items expiring before "now" are filtered out on read. */
  add(authorId: string, mediaId: string, ttlMs = 24 * 60 * 60 * 1000): Story {
    const now = new Date();
    const s: Story = {
      id: uuidv4(),
      authorId,
      mediaId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString()
    };
    this.items.push(s);
    return s;
  }
  active(now = new Date()): Story[] {
    return this.items.filter((s) => new Date(s.expiresAt) > now);
  }
  byAuthor(authorId: string, now = new Date()): Story[] {
    return this.active(now).filter((s) => s.authorId === authorId);
  }
}

const CreateSchema = z.object({
  mediaId: z.string().uuid(),
  ttlMs: z.number().int().min(60_000).max(7 * 24 * 60 * 60 * 1000).optional()
});

export function buildStoriesRouter(store: StoryStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = CreateSchema.parse(req.body);
      const s = store.add(req.claims!.sub, input.mediaId, input.ttlMs);
      res.status(201).json({ story: s });
    } catch (err) {
      next(err);
    }
  });

  router.get('/active', limiters.read, (_req, res) => {
    res.json({ items: store.active() });
  });

  router.get('/by-author/:userId', limiters.read, (req, res) => {
    res.json({ items: store.byAuthor(String(req.params.userId)) });
  });

  return router;
}
