// RFC 6238 TOTP / RFC 4648 base32 — zero-dep, suitable for 2FA secrets.
//
// We intentionally don't reach for `otplib` here: the surface we need is small,
// every line below is auditable, and avoiding the dep keeps the install lean
// for a service that's already wide in scope.

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Encode arbitrary bytes as RFC 4648 base32 (no padding). */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  return out;
}

/** Decode a base32 string (case-insensitive, ignores spaces/padding). */
export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Generate a new 20-byte (160-bit) TOTP secret, encoded as base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Build an otpauth:// URL for QR codes / authenticator apps. */
export function otpauthUrl(opts: {
  secret: string;
  accountName: string;
  issuer: string;
}): string {
  const label = `${encodeURIComponent(opts.issuer)}:${encodeURIComponent(opts.accountName)}`;
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** TOTP truncation modulo for a 6-digit code (RFC 6238 §4 with digits=6). */
const TOTP_DIGITS_MODULO = 1_000_000;

/** Compute the 6-digit TOTP code for a given secret + timestep counter. */
function hotp(secretBytes: Buffer, counter: number): string {
  // 8-byte big-endian counter. JS can't bit-shift past 32; split into halves.
  const buf = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  buf.writeUInt32BE(high, 0);
  buf.writeUInt32BE(low, 4);

  const hmac = createHmac('sha1', secretBytes).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % TOTP_DIGITS_MODULO).toString().padStart(6, '0');
}

/** Compute current 6-digit TOTP code (mainly useful in tests). */
export function generateTotp(
  secret: string,
  opts: { step?: number; now?: number } = {},
): string {
  const step = opts.step ?? 30;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  return hotp(base32Decode(secret), Math.floor(now / step));
}

/**
 * Verify a 6-digit TOTP code against a base32 secret. Allows ±1 step (default
 * 30s window) to absorb clock skew. Constant-time comparison.
 */
export function verifyTotp(
  secret: string,
  code: string,
  opts: { window?: number; step?: number; now?: number } = {},
): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const step = opts.step ?? 30;
  const window = opts.window ?? 1;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / step);
  const bytes = base32Decode(secret);
  const codeBuf = Buffer.from(code);

  for (let drift = -window; drift <= window; drift++) {
    const expected = hotp(bytes, counter + drift);
    const expBuf = Buffer.from(expected);
    if (expBuf.length === codeBuf.length && timingSafeEqual(expBuf, codeBuf)) {
      return true;
    }
  }
  return false;
}
