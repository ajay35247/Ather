import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  paginateNewestFirst,
  requireJwtSecret
} from '@ather/service-kit';

export type ClassifierLabel = 'safe' | 'nsfw' | 'toxic' | 'spam' | 'csam_suspect';

export interface ClassifyResult {
  label: ClassifierLabel;
  scores: Record<ClassifierLabel, number>;
  /** True when borderline → needs human review. */
  needsReview: boolean;
}

export interface ReviewItem {
  id: string;
  targetKind: 'post' | 'comment' | 'message' | 'media' | 'profile';
  targetId: string;
  reason: string;
  reportedBy?: string;
  status: 'pending' | 'cleared' | 'removed';
  createdAt: string;
  decidedAt?: string;
}

/**
 * Phase 1 classifier stub. Production swaps in a pretrained NSFW/toxicity/spam
 * model (see docs/architecture.md §Intelligence plane). The PhotoDNA / hash
 * matching path for CSAM is documented in docs/security.md and is non-optional
 * before any media goes live.
 */
export function classify(text: string): ClassifyResult {
  const t = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  const scores: Record<ClassifierLabel, number> = {
    safe: 1,
    nsfw: has('nsfw', 'porn', 'xxx') ? 0.9 : 0,
    toxic: has('hate', 'kill yourself', 'idiot') ? 0.85 : 0,
    spam: has('buy now', 'click here', 'http://') ? 0.7 : 0,
    csam_suspect: 0
  };
  let label: ClassifierLabel = 'safe';
  let max = 0.5;
  for (const k of Object.keys(scores) as ClassifierLabel[]) {
    if (k !== 'safe' && scores[k] > max) {
      label = k;
      max = scores[k];
    }
  }
  if (label !== 'safe') scores.safe = 1 - max;
  return {
    label,
    scores,
    needsReview: label !== 'safe' && max < 0.85
  };
}

export class ReviewQueue {
  private items: ReviewItem[] = [];

  enqueue(input: Omit<ReviewItem, 'id' | 'status' | 'createdAt'>): ReviewItem {
    const rec: ReviewItem = {
      id: uuidv4(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...input
    };
    this.items.push(rec);
    return rec;
  }

  pending(): ReviewItem[] {
    return this.items.filter((i) => i.status === 'pending');
  }

  decide(id: string, status: 'cleared' | 'removed'): ReviewItem {
    const it = this.items.find((x) => x.id === id);
    if (!it) throw new Error('review item not found');
    it.status = status;
    it.decidedAt = new Date().toISOString();
    return it;
  }
}

const ClassifySchema = z.object({ text: z.string().min(1).max(5000) });
const ReportSchema = z.object({
  targetKind: z.enum(['post', 'comment', 'message', 'media', 'profile']),
  targetId: z.string().min(1),
  reason: z.string().min(1).max(500),
  reportedBy: z.string().min(1).optional()
});

export function buildModerationRouter(queue: ReviewQueue, _jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();

  router.post('/classify', limiters.write, (req, res, next) => {
    try {
      const { text } = ClassifySchema.parse(req.body);
      res.json(classify(text));
    } catch (err) {
      next(err);
    }
  });

  router.post('/report', limiters.write, (req, res, next) => {
    try {
      const input = ReportSchema.parse(req.body);
      const rec = queue.enqueue(input);
      res.status(201).json({ review: rec });
    } catch (err) {
      next(err);
    }
  });

  router.get('/queue', limiters.read, (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    res.json(paginateNewestFirst(queue.pending(), cursor, limit));
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
