// Pluggable Google ID-token verifier.
//
// The "default" verifier calls Google's tokeninfo endpoint to validate an ID
// token; this avoids pulling in `google-auth-library` and its transitive
// dependency tree just for one call. Tests inject a stub via
// `setGoogleVerifier()` so they never hit the network.
//
// Reference: https://developers.google.com/identity/sign-in/web/backend-auth
// (tokeninfo is a server-side validation pattern Google explicitly documents).

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  sub: string;
  name?: string;
  picture?: string;
}

export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity>;

let activeVerifier: GoogleVerifier = defaultVerifier;

export function setGoogleVerifier(v: GoogleVerifier): void {
  activeVerifier = v;
}

export function resetGoogleVerifier(): void {
  activeVerifier = defaultVerifier;
}

export function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  return activeVerifier(idToken);
}

async function defaultVerifier(idToken: string): Promise<GoogleIdentity> {
  if (typeof idToken !== 'string' || idToken.length === 0 || idToken.length > 4096) {
    throw new Error('Invalid Google ID token');
  }

  // We trust Google's tokeninfo endpoint to validate signature, expiry, and
  // issuer. In production with high-volume auth, swap this for JWKS-based
  // verification (cache keys, verify locally) for lower latency and to avoid
  // per-login dependency on Google's availability.
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;

  // Node 18+ ships global fetch. Guard for older runtimes.
  const fetchFn: typeof fetch | undefined =
    (globalThis as { fetch?: typeof fetch }).fetch;
  if (!fetchFn) {
    throw new Error('Global fetch is unavailable; cannot verify Google token');
  }

  const res = await fetchFn(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error('Google token verification failed');
  }
  const body = (await res.json()) as Record<string, unknown>;

  // tokeninfo returns "aud" — verify it matches the configured client id.
  const expectedAud = process.env.GOOGLE_CLIENT_ID;
  if (expectedAud && body.aud !== expectedAud) {
    throw new Error('Google token audience mismatch');
  }
  // tokeninfo returns expiry as seconds-since-epoch in "exp".
  const exp = Number(body.exp);
  if (Number.isFinite(exp) && exp * 1000 < Date.now()) {
    throw new Error('Google token expired');
  }
  if (!body.email || !body.sub) {
    throw new Error('Google token missing required claims');
  }
  const emailVerified =
    body.email_verified === 'true' || body.email_verified === true;

  return {
    email: String(body.email).toLowerCase(),
    emailVerified,
    sub: String(body.sub),
    name: body.name ? String(body.name) : undefined,
    picture: body.picture ? String(body.picture) : undefined,
  };
}
