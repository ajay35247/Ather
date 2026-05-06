import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, requireJwtSecret } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = Router();

// In-memory store (swap with Prisma/DB in production)
// Object.create(null) prevents prototype pollution attacks via __proto__ keys
const users: Record<string, any> = Object.create(null);
const usersByEmail: Record<string, string> = Object.create(null); // email -> id

function makeTokens(userId: string, email: string) {
  const secret = requireJwtSecret();
  const accessToken = jwt.sign({ userId, email }, secret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId, email }, secret, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post(
  '/register',
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

    const tokens = makeTokens(id, email);
    const { password: _pw, ...safeUser } = users[id];

    res.status(201).json({ success: true, data: { user: safeUser, ...tokens } });
  },
);

// POST /api/auth/login
router.post(
  '/login',
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

    const tokens = makeTokens(userId, email);
    const { password: _pw, ...safeUser } = users[userId];

    res.json({ success: true, data: { user: safeUser, ...tokens } });
  },
);

// POST /api/auth/refresh
router.post('/refresh', (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return next(createError('Refresh token required', 400));

  try {
    const secret = requireJwtSecret();
    const payload = jwt.verify(refreshToken, secret) as { userId: string; email: string };
    const tokens = makeTokens(payload.userId, payload.email);
    res.json({ success: true, data: tokens });
  } catch {
    next(createError('Invalid refresh token', 401));
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = users[req.userId!];
  if (!user) return next(createError('User not found', 404));
  const { password: _pw, ...safeUser } = user;
  res.json({ success: true, data: safeUser });
});

// POST /api/auth/logout
router.post('/logout', authenticate, (_req: AuthRequest, res: Response) => {
  // Stateless JWT: client discards token; add a blocklist in production
  res.json({ success: true, message: 'Logged out successfully' });
});

export { users, usersByEmail };
export default router;
