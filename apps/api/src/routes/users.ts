import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { users } from './auth';
import { createError } from '../middleware/errorHandler';
import { createNotification } from './notifications';
import { stories } from './stories';

const router = Router();

// ── GET /api/users/:id/stories ───────────────────────────────────────────────
// List a single user's active (non-expired) stories, newest-first, with
// cursor pagination. Defined before `/:username` so the more specific route
// is registered first, even though Express matches by full pattern.
//
// Query: ?limit=<1..50> (default 20), ?cursor=<opaque>
// Cursor format: base64("<createdAtISO>|<id>"). Returned stories are strictly
// older than the cursor; ties on createdAt are broken by id for stability.
router.get(
  '/:id/stories',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const target = users[req.params.id];
    if (!target) return next(createError('User not found', 404));

    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.floor(rawLimit), 1), 50)
      : 20;

    let cursorTime = Number.POSITIVE_INFINITY;
    let cursorId = '\uffff';
    if (typeof req.query.cursor === 'string' && req.query.cursor.length > 0) {
      let decoded = '';
      try {
        decoded = Buffer.from(req.query.cursor, 'base64').toString('utf8');
      } catch {
        return next(createError('Invalid cursor', 400));
      }
      const sep = decoded.indexOf('|');
      if (sep <= 0) return next(createError('Invalid cursor', 400));
      const t = Date.parse(decoded.slice(0, sep));
      if (!Number.isFinite(t)) return next(createError('Invalid cursor', 400));
      cursorTime = t;
      cursorId = decoded.slice(sep + 1);
    }

    const now = Date.now();
    const all = Object.values(stories)
      .filter((s) => s.authorId === req.params.id)
      .filter((s) => new Date(s.expiresAt).getTime() > now)
      .sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        if (tb !== ta) return tb - ta;
        return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
      });

    // Strictly older than cursor (createdAt, id).
    const after = all.filter((s) => {
      const t = new Date(s.createdAt).getTime();
      if (t < cursorTime) return true;
      if (t > cursorTime) return false;
      return s.id < cursorId;
    });

    const page = after.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor =
      page.length === limit && last
        ? Buffer.from(`${last.createdAt}|${last.id}`, 'utf8').toString('base64')
        : null;

    const { password: _pw, email: _em, ...publicAuthor } = target as any;

    res.json({
      success: true,
      data: {
        author: publicAuthor,
        stories: page.map((s) => ({
          id: s.id,
          authorId: s.authorId,
          type: s.type,
          text: s.text,
          mediaUrls: s.mediaUrls,
          backgroundColor: s.backgroundColor,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          viewsCount: s.viewers.size,
          reactionsCount: Object.keys(s.reactions).length,
          isViewed: s.viewers.has(req.userId!),
          myReaction: s.reactions[req.userId!] || null,
        })),
        nextCursor,
      },
    });
  },
);

// GET /api/users/:username
router.get('/:username', (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = Object.values(users).find((u: any) => u.username === req.params.username);
  if (!user) return next(createError('User not found', 404));
  const { password: _pw, email: _em, ...publicUser } = user as any;
  res.json({ success: true, data: publicUser });
});

// PATCH /api/users/me
router.patch('/me', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = users[req.userId!];
  if (!user) return next(createError('User not found', 404));

  const allowed = ['displayName', 'bio', 'website', 'location', 'isPrivate', 'avatar'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) {
      user[field] = req.body[field];
    }
  });

  const { password: _pw, ...safeUser } = user;
  res.json({ success: true, data: safeUser });
});

// POST /api/users/:id/follow
router.post('/:id/follow', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const target = users[req.params.id];
  if (!target) return next(createError('User not found', 404));
  if (req.params.id === req.userId) return next(createError('Cannot follow yourself', 400));

  target.followersCount = (target.followersCount || 0) + 1;
  const me = users[req.userId!];
  if (me) me.followingCount = (me.followingCount || 0) + 1;

  // Notify the followee. Self-follow is rejected above so this is always cross-user.
  createNotification(target.id, 'user.follow', req.userId!, 'started following you', target.id);

  res.json({ success: true, message: 'Followed successfully' });
});

// DELETE /api/users/:id/follow
router.delete(
  '/:id/follow',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const target = users[req.params.id];
    if (!target) return next(createError('User not found', 404));

    target.followersCount = Math.max(0, (target.followersCount || 1) - 1);
    const me = users[req.userId!];
    if (me) me.followingCount = Math.max(0, (me.followingCount || 1) - 1);

    res.json({ success: true, message: 'Unfollowed successfully' });
  },
);

// GET /api/users/search?q=
router.get('/', (req: AuthRequest, res: Response) => {
  const q = ((req.query.q as string) || '').toLowerCase();
  const results = Object.values(users)
    .filter(
      (u: any) =>
        u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q),
    )
    .map(({ password: _pw, email: _em, ...pub }: any) => pub)
    .slice(0, 20);

  res.json({ success: true, data: results });
});

export default router;
