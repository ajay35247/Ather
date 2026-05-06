import { Router } from 'express';
import { z } from 'zod';
import {
  defaultLimiters,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest
} from '@ather/service-kit';

/**
 * Phase 1 wallet read-projection. Maintains a per-user balance fed by
 * upstream ledger events (or, in this stub, a direct setBalance call from
 * tests/seeds). Production wires this to the ledger's CDC stream.
 */
export class WalletStore {
  private balances = new Map<string, { balance: number; currency: 'INR' | 'USD' | 'EUR' }>();
  setBalance(userId: string, balance: number, currency: 'INR' | 'USD' | 'EUR' = 'INR'): void {
    this.balances.set(userId, { balance, currency });
  }
  get(userId: string): { balance: number; currency: 'INR' | 'USD' | 'EUR' } {
    return this.balances.get(userId) ?? { balance: 0, currency: 'INR' };
  }
}

const SetSchema = z.object({
  userId: z.string().min(1),
  balance: z.number().int(),
  currency: z.enum(['INR', 'USD', 'EUR']).default('INR')
});

export function buildWalletRouter(
  store: WalletStore,
  internalSecret: string,
  jwtSecret: string,
  isTest: boolean
) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.get('/me', limiters.read, auth, (req: AuthedRequest, res) => {
    res.json({ wallet: store.get(req.claims!.sub) });
  });

  router.post('/internal/set', limiters.write, (req, res, next) => {
    if (req.header('x-internal-secret') !== internalSecret) {
      res.status(401).json({ status: 401, code: 'unauthorized' });
      return;
    }
    try {
      const input = SetSchema.parse(req.body);
      store.setBalance(input.userId, input.balance, input.currency);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
