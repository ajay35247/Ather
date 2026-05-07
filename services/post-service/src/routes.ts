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

export type PostType = 'text' | 'image' | 'video' | 'reel' | 'poll' | 'story';
export type Visibility = 'public' | 'followers' | 'close_friends' | 'custom';

export interface PostRecord {
  id: string;
  authorId: string;
  type: PostType;
  body?: string;
  mediaId?: string;
  visibility: Visibility;
  createdAt: string;
  deletedAt?: string;
}

export interface ReactionRecord {
  postId: string;
  userId: string;
  kind: string;
  createdAt: string;
}

export class PostStore {
  private posts: PostRecord[] = [];
  private reactions: ReactionRecord[] = [];

  create(input: Omit<PostRecord, 'id' | 'createdAt'>): PostRecord {
    const rec: PostRecord = { id: uuidv4(), createdAt: new Date().toISOString(), ...input };
    this.posts.push(rec);
    return rec;
  }

  get(id: string): PostRecord | null {
    const p = this.posts.find((x) => x.id === id);
    return p && !p.deletedAt ? p : null;
  }

  byAuthor(authorId: string): PostRecord[] {
    return this.posts.filter((p) => p.authorId === authorId && !p.deletedAt);
  }

  delete(id: string, by: string): PostRecord {
    const p = this.posts.find((x) => x.id === id);
    if (!p || p.deletedAt) throw new NotFoundError('post not found');
    if (p.authorId !== by) throw new ForbiddenError('not author');
    p.deletedAt = new Date().toISOString();
    return p;
  }

  react(postId: string, userId: string, kind: string): ReactionRecord {
    const p = this.get(postId);
    if (!p) throw new NotFoundError('post not found');
    let rec = this.reactions.find(
      (r) => r.postId === postId && r.userId === userId && r.kind === kind
    );
    if (!rec) {
      rec = { postId, userId, kind, createdAt: new Date().toISOString() };
      this.reactions.push(rec);
    }
    return rec;
  }

  reactionCount(postId: string): number {
    return this.reactions.filter((r) => r.postId === postId).length;
  }
}

const CreateSchema = z.object({
  type: z.enum(['text', 'image', 'video', 'reel', 'poll', 'story']),
  body: z.string().max(5000).optional(),
  mediaId: z.string().uuid().optional(),
  visibility: z.enum(['public', 'followers', 'close_friends', 'custom']).default('public')
});

const ReactSchema = z.object({
  kind: z.string().regex(/^[a-z_]{1,16}$/, 'invalid reaction kind')
});

export function buildPostRouter(store: PostStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = CreateSchema.parse(req.body);
      const rec = store.create({
        authorId: req.claims!.sub,
        type: input.type,
        body: input.body,
        mediaId: input.mediaId,
        visibility: input.visibility
      });
      res.status(201).json({ post: rec });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', limiters.read, (req, res, next) => {
    try {
      const p = store.get(String(req.params.id));
      if (!p) throw new NotFoundError('post not found');
      res.json({ post: p, reactions: store.reactionCount(p.id) });
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

  router.post('/:id/reactions', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const { kind } = ReactSchema.parse(req.body);
      const r = store.react(String(req.params.id), req.claims!.sub, kind);
      res.status(201).json({ reaction: r });
    } catch (err) {
      next(err);
    }
  });

  router.get('/by-author/:userId', limiters.read, (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const all = store.byAuthor(String(req.params.userId));
    res.json(paginateNewestFirst(all, cursor, limit));
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
