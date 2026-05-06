import bcrypt from 'bcryptjs';

/**
 * Phase 0 placeholder: bcryptjs (pure JS, CI-friendly).
 *
 * Phase 1 MUST replace with argon2id (`argon2` npm package) per docs/security.md.
 * Keep this module as the single point of change.
 */

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
