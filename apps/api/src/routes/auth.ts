import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { createHash } from 'crypto';
import { authenticate, AuthRequest, requireJwtSecret } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { limiters, makeLimiter } from '../middleware/rateLimits';
import {
  generateTotpSecret,
  otpauthUrl,
  verifyTotp,
} from '../lib/totp';
import { issueOtp, verifyOtp } from '../lib/otpStore';
import { verifyGoogleIdToken } from '../lib/googleVerifier';

const router = Router();

// In-memory store (swap with Prisma/DB in production)
// Object.create(null) prevents prototype pollution attacks via __proto__ keys
const users: Record<string, any> = Object.create(null);
const usersByEmail: Record<string, string> = Object.create(null); // email -> id
const usersByGoogleSub: Record<string, string> = Object.create(null); // google sub -> id

// ── Refresh-token families (rotation + reuse detection) ─────────────────────
//
// Every login/register issues a brand-new "family" (fid). Each refresh
// rotates the refresh token: the old jti is retired, a new jti becomes the
// family's only valid one. If a retired jti is presented again (because an
// attacker stole it from disk, browser, or wire), we revoke the entire family
// — the legitimate user is forced to log in again, but the attacker is also
// locked out. This is the "reuse detection" pattern from RFC 6819 §5.2.2.3.
//
// Each family also carries device metadata (userAgent + ip + timestamps) so
// users can list active sessions and revoke them from settings UI.
//
// Production swap: persist `families` in Redis with TTL = refresh expiry, so
// the state survives restarts and is shared across API replicas.
interface RefreshFamily {
  fid: string;
  userId: string;
  /** Currently-valid jti. A presented jti not equal to this means reuse. */
  currentJti: string;
  revoked: boolean;
  createdAt: number;
  lastUsedAt: number;
  userAgent?: string;
  ip?: string;
}
const families: Record<string, RefreshFamily> = Object.create(null);

const REFRESH_TTL = '30d';
const ACCESS_TTL = '15m';
const MFA_TICKET_TTL = '5m';
const RESET_TICKET_TTL = '15m';

/** Truncate a free-form string so it can't bloat the in-memory family record. */
function clipString(s: unknown, max = 256): string | undefined {
  if (typeof s !== 'string') return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function deviceFromReq(req: Request): { userAgent?: string; ip?: string } {
  return {
    userAgent: clipString(req.headers['user-agent']),
    ip: clipString(req.ip),
  };
}

function startFamily(
  userId: string,
  device: { userAgent?: string; ip?: string } = {},
): RefreshFamily {
  const fid = uuidv4();
  const now = Date.now();
  const fam: RefreshFamily = {
    fid,
    userId,
    currentJti: uuidv4(),
    revoked: false,
    createdAt: now,
    lastUsedAt: now,
    userAgent: device.userAgent,
    ip: device.ip,
  };
  families[fid] = fam;
  return fam;
}

function rotateFamily(fam: RefreshFamily): RefreshFamily {
  fam.currentJti = uuidv4();
  fam.lastUsedAt = Date.now();
  return fam;
}

function revokeFamily(fid: string): void {
  if (families[fid]) families[fid].revoked = true;
}

/** Revoke every active family belonging to a user (e.g. after password reset). */
function revokeAllFamiliesForUser(userId: string): number {
  let n = 0;
  for (const f of Object.values(families)) {
    if (f.userId === userId && !f.revoked) {
      f.revoked = true;
      n++;
    }
  }
  return n;
}

function makeTokens(userId: string, email: string, fam: RefreshFamily) {
  const secret = requireJwtSecret();
  const accessToken = jwt.sign({ userId, email }, secret, { expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign(
    { userId, email, fid: fam.fid, jti: fam.currentJti, typ: 'refresh' },
    secret,
    { expiresIn: REFRESH_TTL },
  );
  return { accessToken, refreshToken };
}

/**
 * Strip private fields from a user record before sending it to a client.
 * Centralised so new private fields (mfaSecret, passwordResetAt, ...) can't
 * accidentally leak by being forgotten in one of many response sites.
 */
function publicUser(u: Record<string, any>): Record<string, any> {
  const {
    password: _pw,
    mfaSecret: _ms,
    mfaPendingSecret: _mps,
    ...safe
  } = u;
  return { ...safe, mfaEnabled: !!u.mfaEnabled };
}

// Tight limiters for new sensitive routes. These piggy-back on the shared
// `makeLimiter` so they're also bypassed in tests (NODE_ENV==='test').
const otpRequestLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many OTP requests. Try again later.',
});
const otpVerifyLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many OTP attempts. Try again later.',
});
const forgotLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many password-reset requests.',
});
const resetLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many password-reset attempts.',
});
const twoFaLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many 2FA attempts.',
});

// POST /api/auth/register
router.post(
  '/register',
  limiters.register,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('username').isAlphanumeric().isLength({ min: 3, max: 30 }),
    body('displayName').trim().notEmpty(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(errors.array()[0].msg, 400));
    }

    const { email, password, username, displayName } = req.body;

    if (usersByEmail[email]) {
      return next(createError('Email already registered', 409));
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const now = new Date().toISOString();

    users[id] = {
      id,
      username,
      displayName,
      email,
      password: hashedPassword,
      avatar: null,
      bio: '',
      isVerified: false,
      isPrivate: false,
      reputation: 0,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      mfaEnabled: false,
      mfaSecret: null,
      mfaPendingSecret: null,
      googleSub: null,
      createdAt: now,
    };
    usersByEmail[email] = id;

    const fam = startFamily(id, deviceFromReq(req));
    const tokens = makeTokens(id, email, fam);

    res.status(201).json({ success: true, data: { user: publicUser(users[id]), ...tokens } });
  },
);

// POST /api/auth/login
router.post(
  '/login',
  limiters.login,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(errors.array()[0].msg, 400));
    }

    const { email, password, otp } = req.body;
    const userId = usersByEmail[email];

    if (!userId || !users[userId]?.password) {
      return next(createError('Invalid credentials', 401));
    }
    if (!(await bcrypt.compare(password, users[userId].password))) {
      return next(createError('Invalid credentials', 401));
    }

    const user = users[userId];

    // 2FA gate: if the user enrolled, we need a TOTP code before issuing
    // long-lived tokens. Two supported flows:
    //   a) client passes `otp` in this same request → verify, issue tokens.
    //   b) client doesn't pass `otp` → return a short-lived `mfaToken`; client
    //      then calls /2fa/verify with token+otp.
    if (user.mfaEnabled && user.mfaSecret) {
      if (typeof otp === 'string' && otp.length > 0) {
        if (!verifyTotp(user.mfaSecret, otp)) {
          return next(createError('Invalid 2FA code', 401));
        }
        // fall through to issue tokens
      } else {
        const secret = requireJwtSecret();
        const mfaToken = jwt.sign(
          { userId, email, typ: 'mfa' },
          secret,
          { expiresIn: MFA_TICKET_TTL },
        );
        return res.json({
          success: true,
          data: { mfaRequired: true, mfaToken },
        });
      }
    }

    const fam = startFamily(userId, deviceFromReq(req));
    const tokens = makeTokens(userId, email, fam);

    res.json({ success: true, data: { user: publicUser(user), ...tokens } });
  },
);

// POST /api/auth/refresh
//
// Rotation + reuse detection. Three outcomes:
//   ✓ valid + matches current jti → issue new pair, retire old jti
//   ✗ valid signature but jti != currentJti → REUSE, revoke entire family
//   ✗ invalid / expired / revoked   → 401
router.post('/refresh', limiters.refresh, (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return next(createError('Refresh token required', 400));

  let payload: { userId: string; email: string; fid?: string; jti?: string; typ?: string };
  try {
    const secret = requireJwtSecret();
    payload = jwt.verify(refreshToken, secret) as typeof payload;
  } catch {
    return next(createError('Invalid refresh token', 401));
  }

  if (payload.typ !== 'refresh' || !payload.fid || !payload.jti) {
    return next(createError('Invalid refresh token', 401));
  }

  const fam = families[payload.fid];
  if (!fam || fam.revoked || fam.userId !== payload.userId) {
    return next(createError('Refresh token revoked', 401));
  }

  if (fam.currentJti !== payload.jti) {
    // Token reuse — either a leaked old token or a replay attack. Kill the
    // whole family so neither attacker nor victim can continue using it.
    revokeFamily(fam.fid);
    return next(createError('Refresh token reuse detected — please sign in again', 401));
  }

  rotateFamily(fam);
  // Refresh implies the device is still alive — useful for sessions list.
  fam.lastUsedAt = Date.now();
  const newDevice = deviceFromReq(req);
  if (newDevice.userAgent) fam.userAgent = newDevice.userAgent;
  if (newDevice.ip) fam.ip = newDevice.ip;
  const tokens = makeTokens(payload.userId, payload.email, fam);
  res.json({ success: true, data: tokens });
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = users[req.userId!];
  if (!user) return next(createError('User not found', 404));
  res.json({ success: true, data: publicUser(user) });
});

// POST /api/auth/logout
//
// Revokes the family associated with the supplied refresh token (if any), so
// stolen refresh tokens can't outlive an explicit logout. The access token is
// stateless and dies on its own at most 15 min later.
router.post('/logout', authenticate, (req: AuthRequest, res: Response) => {
  const { refreshToken } = req.body || {};
  if (typeof refreshToken === 'string' && refreshToken.length > 0) {
    try {
      const secret = requireJwtSecret();
      const payload = jwt.verify(refreshToken, secret) as { fid?: string };
      if (payload.fid) revokeFamily(payload.fid);
    } catch {
      // Best-effort revoke: a malformed refresh token on logout is not an error.
    }
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// ── Google OAuth ─────────────────────────────────────────────────────────────
//
// POST /api/auth/google { idToken }
// Verifies a Google ID token, creates a user on first use, returns app tokens.
//
// `users.password` is a bcrypt hash — for Google-only users we store a random
// hash so password login can't accidentally succeed against an unset string.
router.post(
  '/google',
  limiters.login,
  [body('idToken').isString().notEmpty().isLength({ max: 4096 })],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(errors.array()[0].msg, 400));

    let identity;
    try {
      identity = await verifyGoogleIdToken(req.body.idToken);
    } catch {
      return next(createError('Google sign-in failed', 401));
    }
    if (!identity.emailVerified) {
      return next(createError('Google account email is not verified', 401));
    }

    let userId = usersByGoogleSub[identity.sub] || usersByEmail[identity.email];
    if (!userId) {
      // Provision a new account on first Google sign-in. We synthesize a
      // username from the email local-part with a short uid suffix; collisions
      // are vanishingly unlikely and easy to rename later.
      const id = uuidv4();
      const usernameBase = identity.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      const username = `${usernameBase.slice(0, 20) || 'user'}${id.slice(0, 6)}`;
      const randomHash = await bcrypt.hash(uuidv4() + uuidv4(), 12);
      users[id] = {
        id,
        username,
        displayName: identity.name || usernameBase || 'New User',
        email: identity.email,
        password: randomHash,
        avatar: identity.picture || null,
        bio: '',
        isVerified: false,
        isPrivate: false,
        reputation: 0,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        mfaEnabled: false,
        mfaSecret: null,
        mfaPendingSecret: null,
        googleSub: identity.sub,
        createdAt: new Date().toISOString(),
      };
      usersByEmail[identity.email] = id;
      usersByGoogleSub[identity.sub] = id;
      userId = id;
    } else {
      // Link sub to existing account if not yet linked.
      if (!users[userId].googleSub) {
        users[userId].googleSub = identity.sub;
        usersByGoogleSub[identity.sub] = userId;
      }
    }

    // Google-authenticated logins still respect 2FA. If the user enrolled,
    // require a TOTP code via the same MFA-ticket flow as password login.
    const user = users[userId];
    if (user.mfaEnabled && user.mfaSecret) {
      const otp = typeof req.body.otp === 'string' ? req.body.otp : '';
      if (otp) {
        if (!verifyTotp(user.mfaSecret, otp)) {
          return next(createError('Invalid 2FA code', 401));
        }
      } else {
        const secret = requireJwtSecret();
        const mfaToken = jwt.sign(
          { userId, email: user.email, typ: 'mfa' },
          secret,
          { expiresIn: MFA_TICKET_TTL },
        );
        return res.json({ success: true, data: { mfaRequired: true, mfaToken } });
      }
    }

    const fam = startFamily(userId, deviceFromReq(req));
    const tokens = makeTokens(userId, user.email, fam);
    res.json({ success: true, data: { user: publicUser(user), ...tokens } });
  },
);

// ── Email OTP (sign-in / verification) ───────────────────────────────────────
//
// POST /api/auth/otp/request { email }
// Generates a 6-digit code tied to (email, 'login'). In dev/test the code is
// returned in the response so suites and local devs aren't blocked on a real
// mailer. In production, set OTP_RETURN_CODE!=='true' so the code is only
// delivered via the configured email transport (wired by the caller).
router.post(
  '/otp/request',
  otpRequestLimiter,
  [body('email').isEmail().normalizeEmail()],
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(errors.array()[0].msg, 400));

    const { email } = req.body;
    const code = issueOtp({ subject: email, purpose: 'login', ttlMs: 10 * 60 * 1000 });

    // Avoid account-enumeration: respond 200 whether or not the email exists.
    // The OTP is still issued (it's keyed by email, not userId) but only
    // resolves to a session if a user actually exists at verify-time.

    const exposeCode =
      process.env.NODE_ENV !== 'production' || process.env.OTP_RETURN_CODE === 'true';
    res.json({
      success: true,
      data: { sent: true, ...(exposeCode ? { devCode: code } : {}) },
    });
  },
);

// POST /api/auth/otp/verify { email, code }
router.post(
  '/otp/verify',
  otpVerifyLimiter,
  [body('email').isEmail().normalizeEmail(), body('code').isString().isLength({ min: 6, max: 6 })],
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(errors.array()[0].msg, 400));

    const { email, code } = req.body;
    const result = verifyOtp({ subject: email, purpose: 'login', code });
    if (!result.ok) return next(createError('Invalid or expired code', 401));

    const userId = usersByEmail[email];
    if (!userId) return next(createError('No account for this email', 404));

    const user = users[userId];
    // OTP login bypasses the password — that's the point — but it must still
    // respect 2FA when enrolled. Same ticket flow as /login.
    if (user.mfaEnabled && user.mfaSecret) {
      const secret = requireJwtSecret();
      const mfaToken = jwt.sign(
        { userId, email, typ: 'mfa' },
        secret,
        { expiresIn: MFA_TICKET_TTL },
      );
      return res.json({ success: true, data: { mfaRequired: true, mfaToken } });
    }

    const fam = startFamily(userId, deviceFromReq(req));
    const tokens = makeTokens(userId, email, fam);
    res.json({ success: true, data: { user: publicUser(user), ...tokens } });
  },
);

// ── Forgot / reset password ──────────────────────────────────────────────────
//
// Implemented with a signed, single-purpose reset ticket so we don't need a
// separate persistent reset-tokens table. The ticket embeds (userId, prHash):
//   prHash = sha256(currentPasswordHash) — when the password changes, all
//   outstanding tickets are invalidated because their prHash no longer matches.

function passwordHashFingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 32);
}

// POST /api/auth/password/forgot { email }
router.post(
  '/password/forgot',
  forgotLimiter,
  [body('email').isEmail().normalizeEmail()],
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(errors.array()[0].msg, 400));

    const { email } = req.body;
    const userId = usersByEmail[email];

    // Always 200 to avoid account enumeration; only mint a ticket if the
    // account exists.
    let devResetToken: string | undefined;
    if (userId) {
      const user = users[userId];
      const secret = requireJwtSecret();
      const resetToken = jwt.sign(
        { userId, typ: 'pwreset', prHash: passwordHashFingerprint(user.password) },
        secret,
        { expiresIn: RESET_TICKET_TTL },
      );
      if (
        process.env.NODE_ENV !== 'production' ||
        process.env.OTP_RETURN_CODE === 'true'
      ) {
        devResetToken = resetToken;
      }
      // In production the token should be emailed; the wiring is left to the
      // notification-service / email transport layer.
    }
    res.json({ success: true, data: { sent: true, ...(devResetToken ? { devResetToken } : {}) } });
  },
);

// POST /api/auth/password/reset { token, password }
router.post(
  '/password/reset',
  resetLimiter,
  [
    body('token').isString().notEmpty().isLength({ max: 4096 }),
    body('password').isLength({ min: 8 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(errors.array()[0].msg, 400));

    let payload: { userId?: string; typ?: string; prHash?: string };
    try {
      const secret = requireJwtSecret();
      payload = jwt.verify(req.body.token, secret) as typeof payload;
    } catch {
      return next(createError('Invalid or expired reset token', 401));
    }
    if (payload.typ !== 'pwreset' || !payload.userId) {
      return next(createError('Invalid reset token', 401));
    }

    const user = users[payload.userId];
    if (!user) return next(createError('Invalid reset token', 401));
    if (payload.prHash !== passwordHashFingerprint(user.password)) {
      return next(createError('Reset token no longer valid', 401));
    }

    user.password = await bcrypt.hash(req.body.password, 12);
    // Revoke every existing session so a stolen token can't outlive the reset.
    revokeAllFamiliesForUser(payload.userId);

    res.json({ success: true });
  },
);

// ── 2FA (TOTP) ───────────────────────────────────────────────────────────────
//
// Setup flow:
//   POST /2fa/setup         → returns base32 secret + otpauth URL; stored as
//                             `mfaPendingSecret` until the user proves they
//                             can produce a valid code.
//   POST /2fa/enable {otp}  → if otp verifies against the pending secret,
//                             promote it to `mfaSecret`, set mfaEnabled=true.
//   POST /2fa/disable {otp} → require a valid TOTP to disable, then clear.
//   POST /2fa/verify {mfaToken, otp} → finish a login that returned mfaRequired.
router.post('/2fa/setup', authenticate, twoFaLimiter, (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = users[req.userId!];
  if (!user) return next(createError('User not found', 404));
  const secret = generateTotpSecret();
  user.mfaPendingSecret = secret;
  res.json({
    success: true,
    data: {
      secret,
      otpauthUrl: otpauthUrl({
        secret,
        accountName: user.email,
        issuer: process.env.MFA_ISSUER || 'Ather',
      }),
    },
  });
});

router.post(
  '/2fa/enable',
  authenticate,
  twoFaLimiter,
  [body('otp').isString().isLength({ min: 6, max: 6 })],
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(errors.array()[0].msg, 400));

    const user = users[req.userId!];
    if (!user) return next(createError('User not found', 404));
    if (!user.mfaPendingSecret) return next(createError('Run /2fa/setup first', 400));

    if (!verifyTotp(user.mfaPendingSecret, req.body.otp)) {
      return next(createError('Invalid 2FA code', 401));
    }
    user.mfaSecret = user.mfaPendingSecret;
    user.mfaPendingSecret = null;
    user.mfaEnabled = true;
    res.json({ success: true, data: { mfaEnabled: true } });
  },
);

router.post(
  '/2fa/disable',
  authenticate,
  twoFaLimiter,
  [body('otp').isString().isLength({ min: 6, max: 6 })],
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(errors.array()[0].msg, 400));

    const user = users[req.userId!];
    if (!user) return next(createError('User not found', 404));
    if (!user.mfaEnabled || !user.mfaSecret) {
      return next(createError('2FA is not enabled', 400));
    }
    if (!verifyTotp(user.mfaSecret, req.body.otp)) {
      return next(createError('Invalid 2FA code', 401));
    }
    user.mfaEnabled = false;
    user.mfaSecret = null;
    user.mfaPendingSecret = null;
    res.json({ success: true, data: { mfaEnabled: false } });
  },
);

// POST /api/auth/2fa/verify { mfaToken, otp }
// Consumes the short-lived MFA ticket returned by /login (or /google or
// /otp/verify) and, on success, issues real session tokens.
router.post(
  '/2fa/verify',
  twoFaLimiter,
  [
    body('mfaToken').isString().notEmpty().isLength({ max: 4096 }),
    body('otp').isString().isLength({ min: 6, max: 6 }),
  ],
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(errors.array()[0].msg, 400));

    let payload: { userId?: string; email?: string; typ?: string };
    try {
      const secret = requireJwtSecret();
      payload = jwt.verify(req.body.mfaToken, secret) as typeof payload;
    } catch {
      return next(createError('Invalid or expired MFA token', 401));
    }
    if (payload.typ !== 'mfa' || !payload.userId || !payload.email) {
      return next(createError('Invalid MFA token', 401));
    }
    const user = users[payload.userId];
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return next(createError('2FA not enabled for this user', 400));
    }
    if (!verifyTotp(user.mfaSecret, req.body.otp)) {
      return next(createError('Invalid 2FA code', 401));
    }

    const fam = startFamily(payload.userId, deviceFromReq(req));
    const tokens = makeTokens(payload.userId, payload.email, fam);
    res.json({ success: true, data: { user: publicUser(user), ...tokens } });
  },
);

// ── Session / device management ──────────────────────────────────────────────
//
// We expose refresh-token families as "sessions" — one per device. The user's
// *current* session is identified by the refresh token they hold; we surface
// each family's metadata so a settings UI can render a list and let the user
// revoke individual devices.

function summarizeFamily(fam: RefreshFamily, currentFid?: string) {
  return {
    fid: fam.fid,
    createdAt: new Date(fam.createdAt).toISOString(),
    lastUsedAt: new Date(fam.lastUsedAt).toISOString(),
    userAgent: fam.userAgent || null,
    ip: fam.ip || null,
    current: !!currentFid && fam.fid === currentFid,
    revoked: fam.revoked,
  };
}

function currentFidFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const rt = (body as Record<string, unknown>).refreshToken;
  if (typeof rt !== 'string') return undefined;
  try {
    const secret = requireJwtSecret();
    const payload = jwt.verify(rt, secret) as { fid?: string; typ?: string };
    if (payload.typ === 'refresh' && typeof payload.fid === 'string') return payload.fid;
  } catch {
    return undefined;
  }
  return undefined;
}

// GET /api/auth/sessions
router.get('/sessions', authenticate, (req: AuthRequest, res: Response) => {
  const currentFid = currentFidFromBody(req.body);
  const mine = Object.values(families)
    .filter((f) => f.userId === req.userId && !f.revoked)
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .map((f) => summarizeFamily(f, currentFid));
  res.json({ success: true, data: mine });
});

// DELETE /api/auth/sessions/:fid — revoke one device
router.delete('/sessions/:fid', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const fam = families[req.params.fid];
  if (!fam || fam.userId !== req.userId) {
    return next(createError('Session not found', 404));
  }
  fam.revoked = true;
  res.json({ success: true });
});

// DELETE /api/auth/sessions — revoke all sessions except (optionally) the current one
router.delete('/sessions', authenticate, (req: AuthRequest, res: Response) => {
  const currentFid = currentFidFromBody(req.body);
  let revoked = 0;
  for (const f of Object.values(families)) {
    if (f.userId === req.userId && !f.revoked && f.fid !== currentFid) {
      f.revoked = true;
      revoked++;
    }
  }
  res.json({ success: true, data: { revoked } });
});

export { users, usersByEmail, families, revokeFamily };
export default router;
