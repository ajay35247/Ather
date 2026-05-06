import { Router } from 'express';
import { z } from 'zod';
import {
  defaultLimiters,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest
} from '@ather/service-kit';

export interface Candidate {
  id: string;
  authorId: string;
  topicVec: number[];
}

/** Cosine similarity between two equal-length vectors (returns -1..1). */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export class Recommender {
  private candidates: Candidate[] = [];
  private userVecs = new Map<string, number[]>();
  /** Phase 1 stub: production wires this to pgvector / Milvus. */
  index(c: Candidate): void {
    this.candidates = this.candidates.filter((x) => x.id !== c.id);
    this.candidates.push(c);
  }
  setUserVector(userId: string, vec: number[]): void {
    this.userVecs.set(userId, vec);
  }
  /** Two-tower retrieval: top-k by cosine similarity. */
  retrieve(userId: string, k = 20): { id: string; score: number }[] {
    const u = this.userVecs.get(userId);
    if (!u) return [];
    return [...this.candidates]
      .map((c) => ({ id: c.id, score: cosine(u, c.topicVec) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

const RetrieveSchema = z.object({ k: z.number().int().min(1).max(200).optional() });

export function buildRecommendationsRouter(
  rec: Recommender,
  jwtSecret: string,
  isTest: boolean
) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.get('/for-me', limiters.read, auth, (req: AuthedRequest, res, next) => {
    try {
      const { k } = RetrieveSchema.parse({ k: req.query.k ? Number(req.query.k) : undefined });
      res.json({ items: rec.retrieve(req.claims!.sub, k ?? 20) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
