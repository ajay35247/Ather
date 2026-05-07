import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest,
  NotFoundError
} from '@ather/service-kit';

export type Provider = 'stripe' | 'razorpay';
export type IntentStatus = 'requires_action' | 'succeeded' | 'failed';

export interface PaymentIntent {
  id: string;
  userId: string;
  amount: number;
  currency: 'INR' | 'USD' | 'EUR';
  provider: Provider;
  status: IntentStatus;
  createdAt: string;
}

/**
 * Phase 3 payments stub. Production wires `confirm` to Stripe/Razorpay
 * webhooks and posts a balanced ledger entry on success.
 */
export class PaymentStore {
  private intents: PaymentIntent[] = [];
  create(input: Omit<PaymentIntent, 'id' | 'status' | 'createdAt'>): PaymentIntent {
    const i: PaymentIntent = {
      id: uuidv4(),
      status: 'requires_action',
      createdAt: new Date().toISOString(),
      ...input
    };
    this.intents.push(i);
    return i;
  }
  get(id: string): PaymentIntent {
    const i = this.intents.find((x) => x.id === id);
    if (!i) throw new NotFoundError('intent not found');
    return i;
  }
  confirm(id: string, success: boolean): PaymentIntent {
    const i = this.get(id);
    i.status = success ? 'succeeded' : 'failed';
    return i;
  }
}

const CreateSchema = z.object({
  amount: z.number().int().positive().max(10_000_000),
  currency: z.enum(['INR', 'USD', 'EUR']),
  provider: z.enum(['stripe', 'razorpay'])
});

export function buildPaymentsRouter(
  store: PaymentStore,
  internalSecret: string,
  jwtSecret: string,
  isTest: boolean
) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/intents', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = CreateSchema.parse(req.body);
      const i = store.create({ userId: req.claims!.sub, ...input });
      res.status(201).json({ intent: i });
    } catch (err) {
      next(err);
    }
  });

  router.get('/intents/:id', limiters.read, auth, (req, res, next) => {
    try {
      res.json({ intent: store.get(String(req.params.id)) });
    } catch (err) {
      next(err);
    }
  });

  // Webhook endpoint — provider authenticates via shared secret. In production
  // these would be provider-specific signed-payload checks.
  router.post('/webhooks/confirm', limiters.write, (req, res, next) => {
    if (req.header('x-internal-secret') !== internalSecret) {
      res.status(401).json({ status: 401, code: 'unauthorized' });
      return;
    }
    try {
      const { id, success } = z
        .object({ id: z.string().min(1), success: z.boolean() })
        .parse(req.body);
      res.json({ intent: store.confirm(id, success) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
