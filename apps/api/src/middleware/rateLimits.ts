import rateLimit, { Options } from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Rate-limit factory that:
 *  - bypasses limits in tests (NODE_ENV==='test') so suites don't get throttled
 *  - keys by `userId` (when authenticated) and falls back to IP, so a single
 *    abusive user can't share a key with a whole NAT
 *  - returns standard `RateLimit-*` headers; `X-RateLimit-*` legacy headers off
 *
 * Caller MUST set `app.set('trust proxy', N)` upstream so `req.ip` reflects the
 * real client IP behind a load balancer, otherwise IP-based limits are useless.
 */
export function makeLimiter(opts: {
  windowMs: number;
  max: number;
  message?: string;
  /** When true, only count failed requests (status >= 400). Useful for /login. */
  skipSuccessful?: boolean;
}): ReturnType<typeof rateLimit> {
  const isTest = process.env.NODE_ENV === 'test';
  const config: Partial<Options> = {
    windowMs: opts.windowMs,
    max: isTest ? 100_000 : opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: !!opts.skipSuccessful,
    keyGenerator: (req: Request) => {
      // Prefer authenticated user id when present (set by `authenticate`
      // middleware on later routes); fall back to IP for anonymous routes.
      const anyReq = req as Request & { userId?: string };
      return anyReq.userId || req.ip || 'unknown';
    },
    message: { success: false, error: opts.message || 'Too many requests' },
  };
  return rateLimit(config as Options);
}

/** Limit aggressive endpoints: register, login, refresh, password-reset, ai, money. */
export const limiters = {
  /** Account creation: brutal cap to stop signup floods. */
  register: makeLimiter({
    windowMs: 60 * 60 * 1000, // 1h
    max: 10,
    message: 'Too many sign-ups from this address. Try again later.',
  }),
  /** Login: counts only failures so a legitimate user typing slowly isn't blocked. */
  login: makeLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessful: true,
    message: 'Too many failed login attempts. Try again in 15 minutes.',
  }),
  /** Refresh: one bad token shouldn't lock you out forever. */
  refresh: makeLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Too many refresh attempts.',
  }),
  /** AI: per-user budget so a single user can't exhaust model spend. */
  ai: makeLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: 'AI rate limit exceeded. Slow down.',
  }),
  /** Money mutations: tight cap on tip / topup / subscribe. */
  money: makeLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many money operations. Slow down.',
  }),
};
