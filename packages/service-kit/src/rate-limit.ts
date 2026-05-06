import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

export interface LimiterOptions {
  /** Max requests allowed in the window (in production). */
  limit: number;
  /** Window in milliseconds. */
  windowMs: number;
  /** When NODE_ENV==='test' we use a very high cap so suites don't trip. */
  testEnv?: boolean;
}

export function createLimiter(opts: LimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.testEnv ? 1000 : opts.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { status: 429, code: 'rate_limited', detail: 'too many requests' }
  });
}

/** Conventional limiter set used by most Ather services. */
export function defaultLimiters(testEnv: boolean) {
  return {
    read: createLimiter({ windowMs: 60_000, limit: 120, testEnv }),
    write: createLimiter({ windowMs: 60_000, limit: 30, testEnv }),
    auth: createLimiter({ windowMs: 15 * 60_000, limit: 20, testEnv })
  };
}
