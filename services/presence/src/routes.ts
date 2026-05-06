import { Router } from 'express';
import { z } from 'zod';
import {
  defaultLimiters,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest
} from '@ather/service-kit';

export type PresenceState = 'online' | 'offline' | 'away';

export interface PresenceRecord {
  userId: string;
  state: PresenceState;
  /** Last seen timestamp in ms epoch. */
  lastSeen: number;
  typingIn?: string;
}

export class PresenceStore {
  private map = new Map<string, PresenceRecord>();

  set(userId: string, state: PresenceState, typingIn?: string): PresenceRecord {
    const rec: PresenceRecord = { userId, state, lastSeen: Date.now(), typingIn };
    this.map.set(userId, rec);
    return rec;
  }

  get(userId: string): PresenceRecord {
    return (
      this.map.get(userId) ?? {
        userId,
        state: 'offline',
        lastSeen: 0
      }
    );
  }

  bulk(userIds: string[]): Record<string, PresenceRecord> {
    const out: Record<string, PresenceRecord> = {};
    for (const id of userIds) out[id] = this.get(id);
    return out;
  }
}

const HeartbeatSchema = z.object({
  state: z.enum(['online', 'offline', 'away']),
  typingIn: z.string().min(1).max(64).optional()
});

const BulkSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(200)
});

export function buildPresenceRouter(store: PresenceStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/heartbeat', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = HeartbeatSchema.parse(req.body);
      const rec = store.set(req.claims!.sub, input.state, input.typingIn);
      res.json({ presence: rec });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:userId', limiters.read, (req, res) => {
    res.json({ presence: store.get(String(req.params.userId)) });
  });

  router.post('/bulk', limiters.read, (req, res, next) => {
    try {
      const { userIds } = BulkSchema.parse(req.body);
      res.json({ presence: store.bulk(userIds) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
