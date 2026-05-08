/** @type {import('next').NextConfig} */
const isMobileExport = process.env.NEXT_OUTPUT === 'export';

// Security response headers, applied to every served route. Static-export
// builds (`NEXT_OUTPUT=export`) bypass the Node response pipeline entirely,
// so headers there must be set by the host (Vercel project headers /
// Cloudflare Transform Rule / nginx). For the regular Next.js server we set
// them here so the frontend reaches parity with the helmet-protected API.
//
// Notes on choices:
//   - HSTS preload-eligible: 2-year max-age, includeSubDomains, preload.
//   - Frame-Options DENY (not SAMEORIGIN): there's no in-app iframing of
//     same-origin pages, and DENY shuts down clickjacking entirely.
//   - Permissions-Policy: deny by default for the powerful APIs we don't use
//     (camera/microphone/geolocation/payment/usb). The Capacitor Android
//     shell has its own permission story and ignores this header.
//   - Referrer-Policy strict-origin-when-cross-origin: keep referrers within
//     the org but never leak the path/query to third-party CDNs.
//   - CSP is intentionally not set here: Next/dev needs `unsafe-eval` and
//     the inline RSC bootstrap script which would require nonces wired
//     through `_document` to do safely. That's a separate, larger change;
//     setting a wrong CSP is worse than no CSP. Tracked for follow-up.
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Disable cross-origin opener side channels (Spectre).
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isMobileExport && { output: 'export' }),
  trailingSlash: isMobileExport,
  typedRoutes: false,
  images: {
    unoptimized: isMobileExport,
    domains: ['api.dicebear.com', 'picsum.photos', 'images.unsplash.com'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000',
  },
  // `headers()` is a no-op in static-export builds; guarded for clarity.
  ...(isMobileExport
    ? {}
    : {
        async headers() {
          return [{ source: '/:path*', headers: securityHeaders }];
        },
      }),
};

module.exports = nextConfig;
