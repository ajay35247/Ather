import { Router } from 'express';
import { z } from 'zod';
import {
  defaultLimiters,
  paginateNewestFirst,
  requireJwtSecret
} from '@ather/service-kit';

export type Indexable =
  | { kind: 'user'; id: string; handle: string; displayName: string; bio?: string; createdAt: string }
  | { kind: 'post'; id: string; authorId: string; body: string; createdAt: string };

/**
 * Phase 1 search: simple substring match over an in-memory index. Production
 * replaces this with OpenSearch/Elasticsearch (see docs/architecture.md).
 */
export class SearchIndex {
  private docs: Indexable[] = [];

  index(doc: Indexable): void {
    // De-dupe by (kind,id).
    this.docs = this.docs.filter((d) => !(d.kind === doc.kind && d.id === doc.id));
    this.docs.push(doc);
  }

  search(q: string, kind?: 'user' | 'post'): Indexable[] {
    const needle = q.toLowerCase().trim();
    if (!needle) return [];
    return this.docs.filter((d) => {
      if (kind && d.kind !== kind) return false;
      if (d.kind === 'user') {
        return (
          d.handle.toLowerCase().includes(needle) ||
          d.displayName.toLowerCase().includes(needle) ||
          (d.bio?.toLowerCase().includes(needle) ?? false)
        );
      }
      return d.body.toLowerCase().includes(needle);
    });
  }
}

const QuerySchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(['user', 'post']).optional()
});

export function buildSearchRouter(index: SearchIndex, _jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();

  router.get('/', limiters.read, (req, res, next) => {
    try {
      const parsed = QuerySchema.parse({
        q: typeof req.query.q === 'string' ? req.query.q : '',
        type: typeof req.query.type === 'string' ? req.query.type : undefined
      });
      const limit = Math.min(Number(req.query.limit ?? 20), 100);
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const all = index.search(parsed.q, parsed.type);
      res.json({ q: parsed.q, type: parsed.type, ...paginateNewestFirst(all, cursor, limit) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
