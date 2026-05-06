import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, requireJwtSecret } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { limiters } from '../middleware/rateLimits';

const router = Router();

// In-memory store (swap with Prisma/DB in production)
// Object.create(null) prevents prototype pollution attacks via __proto__ keys
const users: Record<string, any> = Object.create(null);
const usersByEmail: Record<string, string> = Object.create(null); // email -> id

// ── Refresh-token families (rotation + reuse detection) ─────────────────────
//
// Every login/register issues a brand-new "family" (fid). Each refresh
// rotates the refresh token: the old jti is retired, a new jti becomes the
// family's only valid one. If a retired jti is presented again (because an
// attacker stole it from disk, browser, or wire), we revoke the entire family
// — the legitimate user is forced to log in again, but the attacker is also
// locked out. This is the "reuse detection" pattern from RFC 6819 §5.2.2.3.
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
}
const families: Record<string, RefreshFamily> = Object.create(null);

const REFRESH_TTL = '30d';
const ACCESS_TTL = '15m';

function startFamily(userId: string): RefreshFamily {
  const fid = uuidv4();
  const fam: RefreshFamily = {
    fid,
    userId,
    currentJti: uuidv4(),
    revoked: false,
    createdAt: Date.now(),
  };
  families[fid] = fam;
  return fam;
}

function rotateFamily(fam: RefreshFamily): RefreshFamily {
  fam.currentJti = uuidv4();
  return fam;
}

function revokeFamily(fid: string): void {
  if (families[fid]) families[fid].revoked = true;
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
      createdAt: now,
    };
    usersByEmail[email] = id;

    const fam = startFamily(id);
    const tokens = makeTokens(id, email, fam);
    const { password: _pw, ...safeUser } = users[id];

    res.status(201).json({ success: true, data: { user: safeUser, ...tokens } });
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

    const { email, password } = req.body;
    const userId = usersByEmail[email];

    if (!userId || !(await bcrypt.compare(password, users[userId]?.password))) {
      return next(createError('Invalid credentials', 401));
    }

    const fam = startFamily(userId);
    const tokens = makeTokens(userId, email, fam);
    const { password: _pw, ...safeUser } = users[userId];

    res.json({ success: true, data: { user: safeUser, ...tokens } });
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
  const tokens = makeTokens(payload.userId, payload.email, fam);
  res.json({ success: true, data: tokens });
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = users[req.userId!];
  if (!user) return next(createError('User not found', 404));
  const { password: _pw, ...safeUser } = user;
  res.json({ success: true, data: safeUser });
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

export { users, usersByEmail, families, revokeFamily };
export default router;
