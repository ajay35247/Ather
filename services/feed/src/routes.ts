import { Router } from 'express';
import { z } from 'zod';
import {
  defaultLimiters,
  paginateNewestFirst,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest
} from '@ather/service-kit';
import { rankSlate, type PostSignals, type ViewerSignals } from './ranker';

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
 *
 * The store can also carry side-data for the ranker (post signals, viewer
 * signals). When present, the `/feed/home?ranker=v1` path runs the
 * production formula in `ranker.ts` instead of the legacy score sort.
 */
export class FeedStore {
  private entries: FeedEntry[] = [];
  private postSignals = new Map<string, PostSignals>();
  private viewerSignals = new Map<string, ViewerSignals>();

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

  /** Register signals for a post (used by ranker v1). */
  setPostSignals(s: PostSignals): void {
    this.postSignals.set(s.postId, s);
  }

  /** Register signals for a viewer (used by ranker v1). */
  setViewerSignals(s: ViewerSignals): void {
    this.viewerSignals.set(s.userId, s);
  }

  /**
   * Build a ranker-v1 slate. Falls back to legacy `forUser('for_you')`
   * if signals haven't been registered for this viewer.
   */
  rankedForUser(userId: string, limit: number): FeedEntry[] {
    const viewer = this.viewerSignals.get(userId);
    if (!viewer) return this.forUser(userId, 'for_you').slice(0, limit);
    const candidates: PostSignals[] = [];
    const byPost = new Map<string, FeedEntry>();
    for (const e of this.entries) {
      if (e.userId !== userId) continue;
      byPost.set(e.postId, e);
      const sig = this.postSignals.get(e.postId);
      if (sig) candidates.push(sig);
    }
    if (candidates.length === 0) return this.forUser(userId, 'for_you').slice(0, limit);
    const slate = rankSlate(viewer, candidates, limit);
    return slate
      .map((s) => {
        const ent = byPost.get(s.postId);
        if (!ent) return null;
        return { ...ent, score: s.score };
      })
      .filter((x): x is FeedEntry => x !== null);
  }

  reset(): void {
    this.entries = [];
    this.postSignals.clear();
    this.viewerSignals.clear();
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
    const useRankerV1 = mode === 'for_you' && req.query.ranker === 'v1';
    if (useRankerV1) {
      // Ranker v1 owns ordering — preserve it by paginating positionally.
      const ranked = store.rankedForUser(req.claims!.sub, 200);
      const off = cursor ? Math.max(0, parseInt(cursor, 10) || 0) : 0;
      const items = ranked.slice(off, off + limit);
      const nextOff = off + items.length;
      res.json({
        mode,
        ranker: 'v1',
        items,
        nextCursor: nextOff < ranked.length ? String(nextOff) : undefined
      });
      return;
    }
    const all = store.forUser(req.claims!.sub, mode);
    res.json({
      mode,
      ranker: 'legacy',
      ...paginateNewestFirst(all, cursor, limit)
    });
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
