import { Router } from 'express';
import { z } from 'zod';
import { defaultLimiters, requireJwtSecret, HttpError } from '@ather/service-kit';

export interface VectorDoc {
  id: string;
  vec: number[];
  meta?: Record<string, string>;
}

class VectorDimError extends HttpError {
  constructor(detail: string) {
    super(400, 'vector_dim_mismatch', detail);
  }
}

/** Phase 1 brute-force vector index. Production wires to pgvector / Qdrant. */
export class VectorIndex {
  private docs: VectorDoc[] = [];
  private dim: number | null = null;
  upsert(d: VectorDoc): VectorDoc {
    if (this.dim === null) this.dim = d.vec.length;
    else if (d.vec.length !== this.dim) {
      throw new VectorDimError(`expected dim ${this.dim} got ${d.vec.length}`);
    }
    this.docs = this.docs.filter((x) => x.id !== d.id);
    this.docs.push(d);
    return d;
  }
  query(vec: number[], k: number): { id: string; score: number; meta?: Record<string, string> }[] {
    if (this.dim !== null && vec.length !== this.dim) {
      throw new VectorDimError(`expected dim ${this.dim} got ${vec.length}`);
    }
    return this.docs
      .map((d) => ({ id: d.id, score: dot(d.vec, vec), meta: d.meta }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

const UpsertSchema = z.object({
  id: z.string().min(1),
  vec: z.array(z.number()).min(1).max(2048),
  meta: z.record(z.string().max(500)).optional()
});

const QuerySchema = z.object({
  vec: z.array(z.number()).min(1).max(2048),
  k: z.number().int().min(1).max(200).default(10)
});

export function buildVectorRouter(index: VectorIndex, _jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();

  router.post('/upsert', limiters.write, (req, res, next) => {
    try {
      res.status(201).json({ doc: index.upsert(UpsertSchema.parse(req.body)) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/query', limiters.read, (req, res, next) => {
    try {
      const input = QuerySchema.parse(req.body);
      res.json({ items: index.query(input.vec, input.k) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
