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

export interface Comment {
  id: string;
  postId: string;
  parentId?: string;
  authorId: string;
  body: string;
  createdAt: string;
  deletedAt?: string;
}

export class CommentStore {
  private items: Comment[] = [];
  add(postId: string, authorId: string, body: string, parentId?: string): Comment {
    if (parentId && !this.items.find((c) => c.id === parentId)) {
      throw new NotFoundError('parent comment not found');
    }
    const c: Comment = {
      id: uuidv4(),
      postId,
      parentId,
      authorId,
      body,
      createdAt: new Date().toISOString()
    };
    this.items.push(c);
    return c;
  }
  forPost(postId: string): Comment[] {
    return this.items.filter((c) => c.postId === postId && !c.deletedAt);
  }
  delete(id: string, by: string): void {
    const c = this.items.find((x) => x.id === id);
    if (!c || c.deletedAt) throw new NotFoundError('comment not found');
    if (c.authorId !== by) throw new ForbiddenError('not author');
    c.deletedAt = new Date().toISOString();
  }
}

const CreateSchema = z.object({
  postId: z.string().min(1),
  body: z.string().min(1).max(2000),
  parentId: z.string().optional()
});

export function buildCommentsRouter(store: CommentStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = CreateSchema.parse(req.body);
      const c = store.add(input.postId, req.claims!.sub, input.body, input.parentId);
      res.status(201).json({ comment: c });
    } catch (err) {
      next(err);
    }
  });

  router.get('/by-post/:postId', limiters.read, (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    res.json(paginateNewestFirst(store.forPost(String(req.params.postId)), cursor, limit));
  });

  router.delete('/:id', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      store.delete(String(req.params.id), req.claims!.sub);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
