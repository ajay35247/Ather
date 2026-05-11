// Short-lived OTP / password-reset code store.
//
// Codes are stored *hashed* (SHA-256) so a memory dump or logs can't replay
// outstanding codes. Each record carries attempt count + expiry; we cap
// attempts to mitigate online brute force on the 6-digit space.
//
// Production swap: persist in Redis with `EX` matching `ttlMs`; replace the
// in-memory map with the Redis client. Interfaces stay identical.

import { createHash, randomInt, timingSafeEqual } from 'crypto';

export interface OtpRecord {
  /** sha256(code) lowercased hex. */
  codeHash: string;
  /** Logical key the caller wants associated with the code (e.g. userId, email). */
  subject: string;
  /** Optional purpose tag — separates flows (e.g. 'login', 'reset'). */
  purpose: string;
  expiresAt: number;
  attempts: number;
}

const MAX_ATTEMPTS = 5;

// Object.create(null) keeps __proto__ keys harmless if a caller ever uses an
// attacker-controlled subject.
const store: Record<string, OtpRecord> = Object.create(null);

function key(subject: string, purpose: string): string {
  return `${purpose}:${subject}`;
}

function hash(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** Generate a cryptographically-random 6-digit code. */
export function generateNumericCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Issue (or overwrite) an OTP for a subject+purpose. Returns the plaintext code. */
export function issueOtp(opts: {
  subject: string;
  purpose: string;
  ttlMs?: number;
}): string {
  const code = generateNumericCode();
  store[key(opts.subject, opts.purpose)] = {
    codeHash: hash(code),
    subject: opts.subject,
    purpose: opts.purpose,
    expiresAt: Date.now() + (opts.ttlMs ?? 10 * 60 * 1000),
    attempts: 0,
  };
  return code;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'expired' | 'too_many_attempts' | 'mismatch' };

/** Verify an OTP, consuming it on success. Constant-time compare. */
export function verifyOtp(opts: {
  subject: string;
  purpose: string;
  code: string;
}): VerifyResult {
  const k = key(opts.subject, opts.purpose);
  const rec = store[k];
  if (!rec) return { ok: false, reason: 'not_found' };
  if (rec.expiresAt < Date.now()) {
    delete store[k];
    return { ok: false, reason: 'expired' };
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    delete store[k];
    return { ok: false, reason: 'too_many_attempts' };
  }
  rec.attempts++;

  if (typeof opts.code !== 'string' || opts.code.length === 0) {
    return { ok: false, reason: 'mismatch' };
  }
  const presented = Buffer.from(hash(opts.code));
  const expected = Buffer.from(rec.codeHash);
  const match =
    presented.length === expected.length && timingSafeEqual(presented, expected);
  if (!match) return { ok: false, reason: 'mismatch' };

  delete store[k];
  return { ok: true };
}

/** Test-only helper to clear the store between cases. */
export function _resetOtpStore(): void {
  for (const k of Object.keys(store)) delete store[k];
}
