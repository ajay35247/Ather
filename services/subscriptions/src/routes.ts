import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest,
  ConflictError,
  NotFoundError
} from '@ather/service-kit';

export type Plan = 'free' | 'plus' | 'pro';

export interface Subscription {
  id: string;
  userId: string;
  creatorId: string;
  plan: Plan;
  status: 'active' | 'cancelled';
  startedAt: string;
  cancelledAt?: string;
}

export class SubscriptionStore {
  private subs: Subscription[] = [];

  subscribe(userId: string, creatorId: string, plan: Plan): Subscription {
    if (userId === creatorId) throw new ConflictError('cannot subscribe to self');
    const existing = this.subs.find(
      (s) => s.userId === userId && s.creatorId === creatorId && s.status === 'active'
    );
    if (existing) {
      existing.plan = plan;
      return existing;
    }
    const s: Subscription = {
      id: uuidv4(),
      userId,
      creatorId,
      plan,
      status: 'active',
      startedAt: new Date().toISOString()
    };
    this.subs.push(s);
    return s;
  }

  cancel(id: string, by: string): Subscription {
    const s = this.subs.find((x) => x.id === id);
    if (!s) throw new NotFoundError('subscription not found');
    if (s.userId !== by) throw new ConflictError('only owner can cancel');
    s.status = 'cancelled';
    s.cancelledAt = new Date().toISOString();
    return s;
  }

  forUser(userId: string): Subscription[] {
    return this.subs.filter((s) => s.userId === userId);
  }
}

const SubSchema = z.object({
  creatorId: z.string().min(1),
  plan: z.enum(['free', 'plus', 'pro'])
});

export function buildSubscriptionsRouter(
  store: SubscriptionStore,
  jwtSecret: string,
  isTest: boolean
) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = SubSchema.parse(req.body);
      res
        .status(201)
        .json({ subscription: store.subscribe(req.claims!.sub, input.creatorId, input.plan) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      res.json({ subscription: store.cancel(String(req.params.id), req.claims!.sub) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', limiters.read, auth, (req: AuthedRequest, res) => {
    res.json({ subscriptions: store.forUser(req.claims!.sub) });
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
