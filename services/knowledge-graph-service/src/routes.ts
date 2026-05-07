import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { defaultLimiters, requireJwtSecret, NotFoundError } from '@ather/service-kit';

export interface Entity {
  id: string;
  type: string;
  name: string;
  /** Free-form attributes. Production stores in a graph DB. */
  attrs: Record<string, string>;
}

export interface Edge {
  id: string;
  fromId: string;
  toId: string;
  rel: string;
}

export class KnowledgeGraph {
  private entities: Entity[] = [];
  private edges: Edge[] = [];
  upsert(e: Omit<Entity, 'id'> & { id?: string }): Entity {
    if (e.id) {
      const ex = this.entities.find((x) => x.id === e.id);
      if (ex) {
        Object.assign(ex, e);
        return ex;
      }
    }
    const rec: Entity = { id: e.id ?? uuidv4(), type: e.type, name: e.name, attrs: e.attrs };
    this.entities.push(rec);
    return rec;
  }
  link(fromId: string, toId: string, rel: string): Edge {
    if (!this.entities.find((e) => e.id === fromId)) throw new NotFoundError('from not found');
    if (!this.entities.find((e) => e.id === toId)) throw new NotFoundError('to not found');
    const ed: Edge = { id: uuidv4(), fromId, toId, rel };
    this.edges.push(ed);
    return ed;
  }
  neighbors(id: string): { entity: Entity; rel: string; direction: 'out' | 'in' }[] {
    const out: { entity: Entity; rel: string; direction: 'out' | 'in' }[] = [];
    for (const e of this.edges) {
      if (e.fromId === id) {
        const n = this.entities.find((x) => x.id === e.toId);
        if (n) out.push({ entity: n, rel: e.rel, direction: 'out' });
      } else if (e.toId === id) {
        const n = this.entities.find((x) => x.id === e.fromId);
        if (n) out.push({ entity: n, rel: e.rel, direction: 'in' });
      }
    }
    return out;
  }
}

const UpsertSchema = z.object({
  id: z.string().optional(),
  type: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/),
  name: z.string().min(1).max(200),
  attrs: z.record(z.string().max(500)).optional()
});

const LinkSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  rel: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/)
});

export function buildKnowledgeGraphRouter(g: KnowledgeGraph, _jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();

  router.post('/entities', limiters.write, (req, res, next) => {
    try {
      const input = UpsertSchema.parse(req.body);
      res.status(201).json({ entity: g.upsert({ ...input, attrs: input.attrs ?? {} }) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/edges', limiters.write, (req, res, next) => {
    try {
      const input = LinkSchema.parse(req.body);
      res.status(201).json({ edge: g.link(input.fromId, input.toId, input.rel) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/entities/:id/neighbors', limiters.read, (req, res) => {
    res.json({ items: g.neighbors(String(req.params.id)) });
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
