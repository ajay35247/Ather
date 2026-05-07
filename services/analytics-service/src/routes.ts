import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { defaultLimiters, requireJwtSecret } from '@ather/service-kit';

export interface AnalyticsEvent {
  id: string;
  userId?: string;
  name: string;
  /** Bag of arbitrary properties — kept tight to avoid PII. */
  props: Record<string, string | number | boolean>;
  receivedAt: string;
}

export class EventSink {
  private events: AnalyticsEvent[] = [];
  push(input: Omit<AnalyticsEvent, 'id' | 'receivedAt'>): AnalyticsEvent {
    const e: AnalyticsEvent = {
      id: uuidv4(),
      receivedAt: new Date().toISOString(),
      ...input
    };
    this.events.push(e);
    return e;
  }
  count(name?: string): number {
    return name ? this.events.filter((e) => e.name === name).length : this.events.length;
  }
}

const TrackSchema = z.object({
  userId: z.string().min(1).optional(),
  name: z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/),
  props: z.record(z.union([z.string().max(500), z.number(), z.boolean()])).optional()
});

export function buildAnalyticsRouter(sink: EventSink, _jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();

  router.post('/track', limiters.write, (req, res, next) => {
    try {
      const input = TrackSchema.parse(req.body);
      const e = sink.push({ userId: input.userId, name: input.name, props: input.props ?? {} });
      res.status(202).json({ accepted: true, id: e.id });
    } catch (err) {
      next(err);
    }
  });

  router.get('/count', limiters.read, (req, res) => {
    const name = typeof req.query.name === 'string' ? req.query.name : undefined;
    res.json({ count: sink.count(name) });
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
