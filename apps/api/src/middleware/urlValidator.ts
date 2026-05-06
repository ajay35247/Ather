/**
 * URL safety helpers.
 *
 * User-supplied URLs (avatars, post media, profile links, etc.) are a major
 * attack surface:
 *   - `javascript:` and `data:` URLs in `<img src>` / `<a href>` → XSS.
 *   - `file://` → local file disclosure if processed server-side.
 *   - URLs pointing at private network ranges (10.0.0.0/8, 172.16/12,
 *     192.168/16, 127/8, 169.254/16, ::1, fc00::/7) → SSRF when the server
 *     ever fetches the URL (image proxy, OG tag scraper, link unfurl, etc.).
 *
 * We allowlist `http:` and `https:` only and reject hostnames that resolve
 * to private/loopback/link-local literals. We don't perform DNS resolution
 * here (that would be a TOCTOU race anyway); the network egress layer is
 * expected to enforce that on top.
 */

// Hostnames we refuse to accept in user URLs to prevent SSRF when a server
// component (image proxy, OG scraper, link unfurl) ever fetches them.
//
// Covers: 127/8 loopback, 10/8, 192.168/16, 172.16-31/12, 169.254/16
// link-local, 0.0.0.0, `localhost`, IPv6 loopback ::1, IPv6 link-local
// `fe80::/10`, IPv6 unique-local `fc00::/7`. We don't perform DNS
// resolution here — that's a TOCTOU race; the network egress layer is
// expected to enforce that on top.
const BLOCKED_HOSTNAME_RE = new RegExp(
  '^(?:' +
    '127(?:\\.\\d{1,3}){3}' +
    '|10(?:\\.\\d{1,3}){3}' +
    '|192\\.168(?:\\.\\d{1,3}){2}' +
    '|172\\.(?:1[6-9]|2\\d|3[01])(?:\\.\\d{1,3}){2}' +
    '|169\\.254(?:\\.\\d{1,3}){2}' +
    '|0(?:\\.\\d{1,3}){3}' +
    '|localhost' +
    '|\\[?::1\\]?' +
    '|\\[?fe80:.*\\]?' +
    '|\\[?fc[0-9a-f]{2}:.*\\]?' +
    ')$',
  'i',
);

export interface UrlValidationOptions {
  /** Allow these protocols (always lowercase, with trailing colon). */
  protocols?: ReadonlyArray<string>;
  /** Hard cap on URL length to prevent DoS via giant strings. */
  maxLength?: number;
}

const DEFAULT_PROTOCOLS = ['http:', 'https:'] as const;

/** Returns true iff `value` is a syntactically-valid, allowlisted, non-private URL. */
export function isSafeHttpUrl(value: unknown, options: UrlValidationOptions = {}): boolean {
  if (typeof value !== 'string') return false;
  const max = options.maxLength ?? 2048;
  if (value.length === 0 || value.length > max) return false;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  const allowed = options.protocols ?? DEFAULT_PROTOCOLS;
  if (!allowed.includes(parsed.protocol)) return false;

  // Reject userinfo (`http://attacker@evil.example/`) — common phishing trick.
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.toLowerCase();
  if (!host) return false;
  if (BLOCKED_HOSTNAME_RE.test(host)) return false;

  return true;
}

/**
 * Validate an array of URLs. Returns the cleaned list (deduped, capped to
 * `maxItems`) or throws `Error` with a descriptive message.
 */
export function validateMediaUrls(
  urls: unknown,
  opts: { maxItems?: number } & UrlValidationOptions = {},
): string[] {
  if (urls === undefined || urls === null) return [];
  if (!Array.isArray(urls)) {
    throw new Error('mediaUrls must be an array');
  }
  const maxItems = opts.maxItems ?? 10;
  if (urls.length > maxItems) {
    throw new Error(`mediaUrls supports at most ${maxItems} entries`);
  }
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    if (!isSafeHttpUrl(u, opts)) {
      throw new Error('mediaUrls contains an invalid or unsafe URL');
    }
    const s = u as string;
    if (seen.has(s)) continue;
    seen.add(s);
    cleaned.push(s);
  }
  return cleaned;
}
