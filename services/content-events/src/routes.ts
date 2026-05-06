import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { defaultLimiters, requireJwtSecret } from '@ather/service-kit';

export interface Event {
  id: string;
  topic: string;
  key?: string;
  payload: unknown;
  emittedAt: string;
}

/**
 * Phase 1 in-memory event log. Production replaces this with Kafka/MSK.
 * Same publish/consume API so swapping is mechanical.
 */
export class EventLog {
  private events: Event[] = [];

  publish(topic: string, payload: unknown, key?: string): Event {
    const e: Event = {
      id: uuidv4(),
      topic,
      key,
      payload,
      emittedAt: new Date().toISOString()
    };
    this.events.push(e);
    return e;
  }

  /** Return events on a topic created after `since` (exclusive). */
  consume(topic: string, since: string | undefined, limit: number): Event[] {
    return this.events
      .filter((e) => e.topic === topic && (!since || e.emittedAt > since))
      .slice(0, limit);
  }
}

const PublishSchema = z.object({
  topic: z.string().regex(/^[a-z][a-z0-9._-]{0,63}$/),
  payload: z.unknown(),
  key: z.string().max(256).optional()
});

export function buildEventsRouter(
  log: EventLog,
  internalSecret: string,
  _jwtSecret: string,
  isTest: boolean
) {
  const limiters = defaultLimiters(isTest);
  const router = Router();

  // Internal-only writes — only services with the shared secret may publish.
  router.post('/publish', limiters.write, (req, res, next) => {
    if (req.header('x-internal-secret') !== internalSecret) {
      res.status(401).json({ status: 401, code: 'unauthorized' });
      return;
    }
    try {
      const input = PublishSchema.parse(req.body);
      const e = log.publish(input.topic, input.payload, input.key);
      res.status(201).json({ event: e });
    } catch (err) {
      next(err);
    }
  });

  router.get('/topic/:topic', limiters.read, (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 1000);
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;
    res.json({ items: log.consume(String(req.params.topic), since, limit) });
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
