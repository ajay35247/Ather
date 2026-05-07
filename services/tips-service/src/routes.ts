import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest,
  ConflictError
} from '@ather/service-kit';

export interface Tip {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number; // minor units
  currency: 'INR' | 'USD' | 'EUR';
  message?: string;
  createdAt: string;
}

export class TipStore {
  private tips: Tip[] = [];
  send(input: Omit<Tip, 'id' | 'createdAt'>): Tip {
    if (input.fromUserId === input.toUserId) {
      throw new ConflictError('cannot tip self');
    }
    const t: Tip = { id: uuidv4(), createdAt: new Date().toISOString(), ...input };
    this.tips.push(t);
    return t;
  }
  received(userId: string): Tip[] {
    return this.tips.filter((t) => t.toUserId === userId);
  }
}

const SendSchema = z.object({
  toUserId: z.string().min(1),
  amount: z.number().int().positive().max(1_000_000),
  currency: z.enum(['INR', 'USD', 'EUR']).default('INR'),
  message: z.string().max(280).optional()
});

export function buildTipsRouter(store: TipStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = SendSchema.parse(req.body);
      const t = store.send({ fromUserId: req.claims!.sub, ...input });
      // In production, this also posts a balanced ledger entry:
      //   debit  user_wallet:from   -amount
      //   credit user_wallet:to     +amount
      // and emits a `tip.sent` event onto content-events.
      res.status(201).json({ tip: t });
    } catch (err) {
      next(err);
    }
  });

  router.get('/received/:userId', limiters.read, (req, res) => {
    res.json({ items: store.received(String(req.params.userId)) });
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
