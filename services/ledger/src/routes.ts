import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  requireJwtSecret,
  HttpError,
  NotFoundError
} from '@ather/service-kit';

/**
 * Ather double-entry ledger. **Phase 3 cornerstone.**
 *
 * Invariants enforced:
 *  - Every journal entry's lines must sum to zero (sum of debits = sum of credits).
 *  - Currency is constant within a journal entry.
 *  - Lines reference existing accounts.
 *  - All amounts are integers in the smallest currency unit (e.g. paise, cents).
 *
 * The same invariants apply in production with Postgres `accounts`,
 * `journal_entries`, `journal_lines` tables wrapped in a single transaction.
 */

export type Currency = 'INR' | 'USD' | 'EUR';
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'user_wallet';

export interface Account {
  id: string;
  /** Human-readable identifier, unique. */
  code: string;
  type: AccountType;
  currency: Currency;
}

export interface JournalLine {
  accountId: string;
  /** Positive = debit, negative = credit. Integer minor units. */
  amount: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  description: string;
  currency: Currency;
  lines: JournalLine[];
  postedAt: string;
}

export class LedgerError extends HttpError {
  constructor(detail: string) {
    super(422, 'ledger_invariant', detail);
  }
}

export class Ledger {
  private accounts: Account[] = [];
  private entries: JournalEntry[] = [];

  openAccount(input: { code: string; type: AccountType; currency: Currency }): Account {
    if (this.accounts.find((a) => a.code === input.code)) {
      throw new LedgerError(`account code ${input.code} already exists`);
    }
    const a: Account = { id: uuidv4(), ...input };
    this.accounts.push(a);
    return a;
  }

  account(idOrCode: string): Account {
    const a = this.accounts.find((x) => x.id === idOrCode || x.code === idOrCode);
    if (!a) throw new NotFoundError(`account ${idOrCode} not found`);
    return a;
  }

  /** Posts a journal entry, enforcing all invariants atomically. */
  post(input: {
    description: string;
    currency: Currency;
    lines: JournalLine[];
  }): JournalEntry {
    if (input.lines.length < 2) {
      throw new LedgerError('a journal entry must have at least two lines');
    }
    let sum = 0;
    for (const ln of input.lines) {
      if (!Number.isInteger(ln.amount)) {
        throw new LedgerError('amounts must be integer minor units');
      }
      const acct = this.account(ln.accountId);
      if (acct.currency !== input.currency) {
        throw new LedgerError(
          `account ${acct.code} currency ${acct.currency} ≠ entry ${input.currency}`
        );
      }
      sum += ln.amount;
    }
    if (sum !== 0) {
      throw new LedgerError(`debits/credits must sum to 0 (got ${sum})`);
    }
    const e: JournalEntry = {
      id: uuidv4(),
      description: input.description,
      currency: input.currency,
      lines: input.lines,
      postedAt: new Date().toISOString()
    };
    this.entries.push(e);
    return e;
  }

  /** Net balance for an account (sum of all line amounts). */
  balance(accountIdOrCode: string): number {
    const a = this.account(accountIdOrCode);
    let bal = 0;
    for (const e of this.entries) {
      for (const ln of e.lines) {
        if (ln.accountId === a.id) bal += ln.amount;
      }
    }
    return bal;
  }

  /** Total of all entries — must always be zero across the entire ledger. */
  globalCheck(): boolean {
    let sum = 0;
    for (const e of this.entries) {
      for (const ln of e.lines) sum += ln.amount;
    }
    return sum === 0;
  }
}

const OpenSchema = z.object({
  code: z.string().regex(/^[a-z0-9._:-]{3,64}$/),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense', 'user_wallet']),
  currency: z.enum(['INR', 'USD', 'EUR'])
});

const PostSchema = z.object({
  description: z.string().min(1).max(200),
  currency: z.enum(['INR', 'USD', 'EUR']),
  lines: z
    .array(
      z.object({
        accountId: z.string().min(1),
        amount: z.number().int(),
        memo: z.string().max(200).optional()
      })
    )
    .min(2)
    .max(64)
});

export function buildLedgerRouter(
  ledger: Ledger,
  internalSecret: string,
  _jwtSecret: string,
  isTest: boolean
) {
  const limiters = defaultLimiters(isTest);
  const router = Router();

  // Internal-only writes: only services with the shared secret can mutate the ledger.
  router.use((req, res, next) => {
    if (req.method === 'GET') return next();
    if (req.header('x-internal-secret') !== internalSecret) {
      res.status(401).json({ status: 401, code: 'unauthorized' });
      return;
    }
    next();
  });

  router.post('/accounts', limiters.write, (req, res, next) => {
    try {
      const a = ledger.openAccount(OpenSchema.parse(req.body));
      res.status(201).json({ account: a });
    } catch (err) {
      next(err);
    }
  });

  router.post('/entries', limiters.write, (req, res, next) => {
    try {
      const e = ledger.post(PostSchema.parse(req.body));
      res.status(201).json({ entry: e });
    } catch (err) {
      next(err);
    }
  });

  router.get('/accounts/:idOrCode/balance', limiters.read, (req, res, next) => {
    try {
      const a = ledger.account(String(req.params.idOrCode));
      res.json({ account: a, balance: ledger.balance(a.id) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/health-check', limiters.read, (_req, res) => {
    res.json({ globalSumZero: ledger.globalCheck() });
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
