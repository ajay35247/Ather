import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  paginateNewestFirst,
  requireJwtSecret,
  NotFoundError
} from '@ather/service-kit';

export interface Plugin {
  id: string;
  appId: string;
  version: string;
  description: string;
  publisherId: string;
  installs: number;
  rating: number;
  createdAt: string;
}

export class PluginCatalog {
  private items: Plugin[] = [];
  list(input: Omit<Plugin, 'id' | 'installs' | 'rating' | 'createdAt'>): Plugin {
    const p: Plugin = {
      id: uuidv4(),
      installs: 0,
      rating: 0,
      createdAt: new Date().toISOString(),
      ...input
    };
    this.items.push(p);
    return p;
  }
  install(id: string): Plugin {
    const p = this.items.find((x) => x.id === id);
    if (!p) throw new NotFoundError('plugin not found');
    p.installs += 1;
    return p;
  }
  search(q: string): Plugin[] {
    const n = q.toLowerCase().trim();
    if (!n) return this.items.slice();
    return this.items.filter((p) => p.description.toLowerCase().includes(n));
  }
}

const ListSchema = z.object({
  appId: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(1).max(500),
  publisherId: z.string().min(1)
});

export function buildMarketplaceRouter(
  catalog: PluginCatalog,
  internalSecret: string,
  _jwtSecret: string,
  isTest: boolean
) {
  const limiters = defaultLimiters(isTest);
  const router = Router();

  router.post('/list', limiters.write, (req, res, next) => {
    if (req.header('x-internal-secret') !== internalSecret) {
      res.status(401).json({ status: 401, code: 'unauthorized' });
      return;
    }
    try {
      res.status(201).json({ plugin: catalog.list(ListSchema.parse(req.body)) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/install', limiters.write, (req, res, next) => {
    try {
      res.json({ plugin: catalog.install(String(req.params.id)) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/search', limiters.read, (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    res.json({ q, ...paginateNewestFirst(catalog.search(q), cursor, limit) });
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
