import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { idempotency } from '../middleware/idempotency';
import { limiters } from '../middleware/rateLimits';
import { users } from './auth';

const router = Router();

/**
 * Monetization module — Phase 3
 *
 * In-memory wallet, tip, and subscription book-keeping. No real money is
 * moved; in production these endpoints would integrate with Stripe / Razorpay
 * and persist to a relational DB inside a transactional boundary.
 */

interface Wallet {
  userId: string;
  balance: number; // in minor currency units (cents/paise)
  currency: 'USD' | 'INR' | 'EUR';
  totalEarned: number;
  totalSpent: number;
}

interface Transaction {
  id: string;
  type: 'tip' | 'subscription' | 'topup' | 'payout' | 'ad_revenue';
  fromUserId?: string;
  toUserId?: string;
  amount: number;
  currency: string;
  note?: string;
  createdAt: string;
}

interface Subscription {
  id: string;
  subscriberId: string;
  creatorId: string;
  tier: 'basic' | 'premium' | 'vip';
  amountPerMonth: number;
  active: boolean;
  startedAt: string;
  cancelledAt?: string;
}

const wallets: Record<string, Wallet> = Object.create(null);
const transactions: Transaction[] = [];
const subscriptions: Record<string, Subscription> = Object.create(null);

function getOrCreateWallet(userId: string): Wallet {
  if (!wallets[userId]) {
    wallets[userId] = {
      userId,
      balance: 0,
      currency: 'USD',
      totalEarned: 0,
      totalSpent: 0,
    };
  }
  return wallets[userId];
}

// ── GET /api/monetization/wallet ────────────────────────────────────────────
router.get('/wallet', authenticate, (req: AuthRequest, res: Response) => {
  const wallet = getOrCreateWallet(req.userId!);
  res.json({ success: true, data: wallet });
});

// ── POST /api/monetization/wallet/topup ─────────────────────────────────────
// Simulates a payment provider topping up a wallet.
//
// `idempotency()` lets clients retry a topup safely (e.g. after a network
// blip) by sending the same `Idempotency-Key`; the second call replays the
// cached response instead of double-crediting the wallet.
router.post(
  '/wallet/topup',
  authenticate,
  limiters.money,
  idempotency(),
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return next(createError('amount must be a positive number ≤ 1,000,000', 400));
    }

    const wallet = getOrCreateWallet(req.userId!);
    wallet.balance += amount;

    const tx: Transaction = {
      id: uuidv4(),
      type: 'topup',
      toUserId: req.userId!,
      amount,
      currency: wallet.currency,
      createdAt: new Date().toISOString(),
    };
    transactions.push(tx);

    res.status(201).json({ success: true, data: { wallet, transaction: tx } });
  },
);

// ── POST /api/monetization/tip ──────────────────────────────────────────────
// Send a tip from the authenticated user to another user.
//
// Idempotent on `Idempotency-Key` — a retried tip will not double-debit.
router.post('/tip', authenticate, limiters.money, idempotency(), (req: AuthRequest, res: Response, next: NextFunction) => {
  const { toUserId, amount, note } = req.body as {
    toUserId?: string;
    amount?: number;
    note?: string;
  };
  const numAmount = Number(amount);

  if (!toUserId) return next(createError('toUserId is required', 400));
  if (toUserId === req.userId) return next(createError('Cannot tip yourself', 400));
  if (!users[toUserId]) return next(createError('Recipient not found', 404));
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return next(createError('amount must be a positive number', 400));
  }
  if (note && typeof note === 'string' && note.length > 280) {
    return next(createError('note too long', 400));
  }

  const fromWallet = getOrCreateWallet(req.userId!);
  if (fromWallet.balance < numAmount) {
    return next(createError('Insufficient balance', 402));
  }

  const toWallet = getOrCreateWallet(toUserId);
  fromWallet.balance -= numAmount;
  fromWallet.totalSpent += numAmount;
  toWallet.balance += numAmount;
  toWallet.totalEarned += numAmount;

  const tx: Transaction = {
    id: uuidv4(),
    type: 'tip',
    fromUserId: req.userId!,
    toUserId,
    amount: numAmount,
    currency: fromWallet.currency,
    note: typeof note === 'string' ? note.slice(0, 280) : undefined,
    createdAt: new Date().toISOString(),
  };
  transactions.push(tx);

  res.status(201).json({ success: true, data: { transaction: tx, wallet: fromWallet } });
});

// ── GET /api/monetization/transactions ─────────────────────────────────────
router.get('/transactions', authenticate, (req: AuthRequest, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const userId = req.userId!;
  const mine = transactions
    .filter((t) => t.fromUserId === userId || t.toUserId === userId)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
  res.json({ success: true, data: mine });
});

// ── POST /api/monetization/subscriptions ───────────────────────────────────
const TIER_PRICE: Record<Subscription['tier'], number> = {
  basic: 499,
  premium: 999,
  vip: 1999,
};

router.post(
  '/subscriptions',
  authenticate,
  limiters.money,
  idempotency(),
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const { creatorId, tier = 'basic' } = req.body as {
      creatorId?: string;
      tier?: Subscription['tier'];
    };
    if (!creatorId) return next(createError('creatorId is required', 400));
    if (creatorId === req.userId) return next(createError('Cannot subscribe to yourself', 400));
    if (!users[creatorId]) return next(createError('Creator not found', 404));
    if (!(tier in TIER_PRICE)) return next(createError('Invalid tier', 400));

    const id = uuidv4();
    const sub: Subscription = {
      id,
      subscriberId: req.userId!,
      creatorId,
      tier,
      amountPerMonth: TIER_PRICE[tier],
      active: true,
      startedAt: new Date().toISOString(),
    };
    subscriptions[id] = sub;
    res.status(201).json({ success: true, data: sub });
  },
);

// ── DELETE /api/monetization/subscriptions/:id ─────────────────────────────
router.delete(
  '/subscriptions/:id',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const sub = subscriptions[req.params.id];
    if (!sub) return next(createError('Subscription not found', 404));
    if (sub.subscriberId !== req.userId) return next(createError('Forbidden', 403));
    sub.active = false;
    sub.cancelledAt = new Date().toISOString();
    res.json({ success: true, data: sub });
  },
);

// ── GET /api/monetization/subscriptions ────────────────────────────────────
// Lists subscriptions for the authenticated user (as subscriber and creator).
router.get('/subscriptions', authenticate, (req: AuthRequest, res: Response) => {
  const list = Object.values(subscriptions).filter(
    (s) => s.subscriberId === req.userId || s.creatorId === req.userId,
  );
  res.json({ success: true, data: list });
});

// ── GET /api/monetization/earnings ─────────────────────────────────────────
// Aggregated earnings dashboard for creators.
router.get('/earnings', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const wallet = getOrCreateWallet(userId);

  const incoming = transactions.filter((t) => t.toUserId === userId);
  const tips = incoming.filter((t) => t.type === 'tip');
  const subs = Object.values(subscriptions).filter(
    (s) => s.creatorId === userId && s.active,
  );

  const monthlyRecurring = subs.reduce((sum, s) => sum + s.amountPerMonth, 0);

  res.json({
    success: true,
    data: {
      wallet,
      tipsCount: tips.length,
      tipsTotal: tips.reduce((s, t) => s + t.amount, 0),
      activeSubscribers: subs.length,
      monthlyRecurring,
      currency: wallet.currency,
    },
  });
});

export { wallets, transactions, subscriptions };
export default router;
