import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth';

/**
 * Idempotency-Key middleware.
 *
 * Money-moving endpoints (tip, topup, subscriptions) MUST be safe to retry.
 * If a client retries the same request — because the response was lost,
 * because the network blipped, because a worker died — we must not move the
 * money twice.
 *
 * Contract:
 *   - Client sends an `Idempotency-Key` header (UUID-style string).
 *   - First request runs the handler; the response body+status are cached
 *     under (userId, key) for `TTL_MS`.
 *   - Subsequent requests with the same (userId, key) return the cached
 *     response with `Idempotent-Replay: true` header — the handler does not
 *     run a second time, so wallet balances cannot be double-debited.
 *
 * Production note: this in-memory map is fine while wallets are also
 * in-memory. When persistence lands, store the cache in Redis with the
 * same TTL so it survives restarts and is shared across replicas.
 */

interface CachedResponse {
  status: number;
  body: unknown;
  expiresAt: number;
}

// (userId|ip + ":" + key) -> cached response. Object.create(null) to defend
// against prototype pollution (cf. apps/api/src/routes/auth.ts).
const cache: Record<string, CachedResponse> = Object.create(null);

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const KEY_RE = /^[A-Za-z0-9_\-:.]{8,128}$/;

function gc(now: number) {
  // Best-effort cleanup; cheap because the cache is small in practice and we
  // only sweep on misses.
  for (const k of Object.keys(cache)) {
    if (cache[k].expiresAt < now) delete cache[k];
  }
}

/**
 * Per-route middleware. Use it before any handler that mutates wallet state.
 *
 *   router.post('/tip', authenticate, idempotency(), handler)
 *
 * If the client omits the header, the request is allowed through (we don't
 * want to break clients during rollout) — but production deployments should
 * tighten this with `{ required: true }`.
 */
export function idempotency(opts: { required?: boolean } = {}) {
  return function idempotencyMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): void {
    const headerVal = req.header('idempotency-key');
    if (!headerVal) {
      if (opts.required) {
        res.status(400).json({
          success: false,
          error: 'Idempotency-Key header is required for this endpoint',
        });
        return;
      }
      return next();
    }

    if (!KEY_RE.test(headerVal)) {
      res.status(400).json({
        success: false,
        error: 'Idempotency-Key must be 8–128 chars of [A-Za-z0-9_-:.]',
      });
      return;
    }

    const subject = req.userId || req.ip || 'anon';
    const cacheKey = `${subject}:${headerVal}`;
    const now = Date.now();
    const hit = cache[cacheKey];

    if (hit && hit.expiresAt > now) {
      res.setHeader('Idempotent-Replay', 'true');
      res.status(hit.status).json(hit.body);
      return;
    }

    if (hit) delete cache[cacheKey]; // expired
    if (Object.keys(cache).length > 5000) gc(now);

    // Wrap res.json so we capture the response body for replay.
    const originalJson = res.json.bind(res);
    (res as Response).json = function patched(body: unknown) {
      // Only cache 2xx responses — failures should be retryable.
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache[cacheKey] = {
          status: res.statusCode,
          body,
          expiresAt: Date.now() + TTL_MS,
        };
      }
      return originalJson(body);
    };

    next();
  };
}

/** For tests: clear the cache between describes. */
export function _clearIdempotencyCache(): void {
  for (const k of Object.keys(cache)) delete cache[k];
}
