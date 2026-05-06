import { Router } from 'express';
import { z } from 'zod';
import { defaultLimiters, requireJwtSecret } from '@ather/service-kit';

export interface Candidate {
  id: string;
  /** Engagement features. Production reranker swaps this for a learned model. */
  features: {
    recencyHours?: number;
    likes?: number;
    views?: number;
    affinity?: number;
  };
}

export interface RankedItem extends Candidate {
  score: number;
}

/**
 * Phase 1 reranker stub: simple linear weights. The contract matches what a
 * gradient-boosted reranker would expose so swapping is mechanical.
 */
export function rank(candidates: Candidate[]): RankedItem[] {
  return candidates
    .map((c) => {
      const f = c.features;
      const recency = f.recencyHours !== undefined ? Math.exp(-f.recencyHours / 12) : 0;
      const score =
        0.3 * Math.log1p(f.views ?? 0) +
        0.4 * Math.log1p(f.likes ?? 0) +
        0.2 * (f.affinity ?? 0) +
        0.1 * recency;
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score);
}

const RankSchema = z.object({
  candidates: z
    .array(
      z.object({
        id: z.string().min(1),
        features: z
          .object({
            recencyHours: z.number().nonnegative().optional(),
            likes: z.number().int().nonnegative().optional(),
            views: z.number().int().nonnegative().optional(),
            affinity: z.number().min(0).max(1).optional()
          })
          .default({})
      })
    )
    .max(10_000)
});

export function buildRankingRouter(_jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();

  router.post('/score', limiters.write, (req, res, next) => {
    try {
      const { candidates } = RankSchema.parse(req.body);
      res.json({ items: rank(candidates) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
