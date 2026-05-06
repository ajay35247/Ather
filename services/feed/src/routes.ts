import { Router } from 'express';
import { z } from 'zod';
import {
  defaultLimiters,
  paginateNewestFirst,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest
} from '@ather/service-kit';

export type FeedMode = 'for_you' | 'following' | 'chronological';

export interface FeedEntry {
  id: string; // postId
  userId: string; // owner
  postId: string;
  authorId: string;
  score: number;
  reason: string;
  createdAt: string;
}

/**
 * Phase 1 feed store: flat in-memory list of materialized entries per user.
 * Ranking is a placeholder — production replaces this with the two-tower
 * retrieval + reranker described in docs/architecture.md.
 */
export class FeedStore {
  private entries: FeedEntry[] = [];

  push(entry: FeedEntry): void {
    this.entries.push(entry);
  }

  forUser(userId: string, mode: FeedMode): FeedEntry[] {
    const mine = this.entries.filter((e) => e.userId === userId);
    if (mode === 'chronological') {
      return [...mine].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
    if (mode === 'following') {
      return [...mine]
        .filter((e) => e.reason === 'following')
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
    // for_you — sort by score desc, ties broken by recency
    return [...mine].sort((a, b) =>
      b.score !== a.score ? b.score - a.score : a.createdAt < b.createdAt ? 1 : -1
    );
  }

  reset(): void {
    this.entries = [];
  }
}

const ReportSchema = z.object({
  targetId: z.string().min(1),
  reason: z.enum(['spam', 'abuse', 'illegal', 'misinformation', 'other']),
  details: z.string().max(500).optional()
});

export function buildFeedRouter(store: FeedStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.get('/home', limiters.read, auth, (req: AuthedRequest, res) => {
    const mode = ((req.query.mode as string) ?? 'for_you') as FeedMode;
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const all = store.forUser(req.claims!.sub, mode);
    res.json({ mode, ...paginateNewestFirst(all, cursor, limit) });
  });

  router.post('/report', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = ReportSchema.parse(req.body);
      // In Phase 1+ this enqueues onto Kafka -> moderation service.
      res.status(202).json({ accepted: true, target: input.targetId });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
