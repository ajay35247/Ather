import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  paginateNewestFirst,
  requireBearerAuth,
  type AuthedRequest,
  ForbiddenError,
  NotFoundError
} from '@ather/service-kit';

export interface Reel {
  id: string;
  authorId: string;
  mediaId: string;
  caption?: string;
  durationMs: number;
  createdAt: string;
  deletedAt?: string;
}

export class ReelStore {
  private items: Reel[] = [];
  create(input: Omit<Reel, 'id' | 'createdAt'>): Reel {
    const r: Reel = { id: uuidv4(), createdAt: new Date().toISOString(), ...input };
    this.items.push(r);
    return r;
  }
  get(id: string): Reel {
    const r = this.items.find((x) => x.id === id);
    if (!r || r.deletedAt) throw new NotFoundError('reel not found');
    return r;
  }
  delete(id: string, by: string): void {
    const r = this.get(id);
    if (r.authorId !== by) throw new ForbiddenError('not author');
    r.deletedAt = new Date().toISOString();
  }
  byAuthor(authorId: string): Reel[] {
    return this.items.filter((r) => r.authorId === authorId && !r.deletedAt);
  }
  all(): Reel[] {
    return this.items.filter((r) => !r.deletedAt);
  }
}

const CreateSchema = z.object({
  mediaId: z.string().uuid(),
  caption: z.string().max(2200).optional(),
  durationMs: z.number().int().min(500).max(90_000)
});

export function buildReelsRouter(store: ReelStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = CreateSchema.parse(req.body);
      const r = store.create({ authorId: req.claims!.sub, ...input });
      res.status(201).json({ reel: r });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', limiters.read, (req, res, next) => {
    try {
      res.json({ reel: store.get(String(req.params.id)) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      store.delete(String(req.params.id), req.claims!.sub);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/', limiters.read, (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    res.json(paginateNewestFirst(store.all(), cursor, limit));
  });

  return router;
}
