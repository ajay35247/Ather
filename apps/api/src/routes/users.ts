import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { users } from './auth';
import { createError } from '../middleware/errorHandler';
import { createNotification } from './notifications';
import { stories } from './stories';
import { isSafeHttpUrl } from '../middleware/urlValidator';

const router = Router();

// ── Follow graph ────────────────────────────────────────────────────────────
// Previously follow/unfollow only manipulated counters. That was idempotency-
// broken in two important ways:
//   1. Repeated POSTs to /follow inflated `followersCount` without bound
//      and fired a fresh `user.follow` notification every time, giving any
//      authenticated client a 1-call notification-spam DoS primitive.
//   2. DELETE /follow always decremented, even from someone who had never
//      followed, allowing arbitrary counter underflow (capped at 0 but
//      still wrong).
// We now track the real edge `(follower, followee)` in a Set per followee.
// Object.create(null) so an actor named `__proto__` can't poison the map.
const followers: Record<string, Set<string>> = Object.create(null); // followeeId -> Set<followerId>
const following: Record<string, Set<string>> = Object.create(null); // followerId -> Set<followeeId>

// Profile-field length caps. Defense in depth on top of the 256kb global
// JSON limit: without these a single PATCH could store ~250kb in `bio`,
// which then ships in every profile response and feed enrichment.
const MAX_BIO_LEN = 1_000;
const MAX_DISPLAY_NAME_LEN = 80;
const MAX_LOCATION_LEN = 120;
const MAX_AVATAR_URL_LEN = 2_048;
const MAX_WEBSITE_URL_LEN = 2_048;

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

  const body = req.body ?? {};

  // String-field validation. Each field is independently optional; we only
  // assign on the user object once *all* presented fields are valid, so a
  // partial-failure update can't half-apply.
  if (body.displayName !== undefined) {
    if (typeof body.displayName !== 'string' || !body.displayName.trim()) {
      return next(createError('displayName must be a non-empty string', 400));
    }
    if (body.displayName.length > MAX_DISPLAY_NAME_LEN) {
      return next(createError(`displayName exceeds ${MAX_DISPLAY_NAME_LEN} characters`, 400));
    }
  }
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string') {
      return next(createError('bio must be a string', 400));
    }
    if (body.bio.length > MAX_BIO_LEN) {
      return next(createError(`bio exceeds ${MAX_BIO_LEN} characters`, 400));
    }
  }
  if (body.location !== undefined) {
    if (typeof body.location !== 'string') {
      return next(createError('location must be a string', 400));
    }
    if (body.location.length > MAX_LOCATION_LEN) {
      return next(createError(`location exceeds ${MAX_LOCATION_LEN} characters`, 400));
    }
  }
  if (body.isPrivate !== undefined && typeof body.isPrivate !== 'boolean') {
    return next(createError('isPrivate must be a boolean', 400));
  }

  // URL-bearing fields are the highest-risk surface: avatar gets rendered
  // in `<img src>` and website in `<a href>` across feed, comments, and
  // profile cards. javascript:/data: URIs trigger XSS; private/loopback
  // hosts can be turned into SSRF when an OG scraper or image proxy ever
  // fetches them. Same allowlist used by posts mediaUrls.
  if (body.avatar !== undefined && body.avatar !== null && body.avatar !== '') {
    if (!isSafeHttpUrl(body.avatar, { maxLength: MAX_AVATAR_URL_LEN })) {
      return next(createError('avatar must be a safe http(s) URL', 400));
    }
  }
  if (body.website !== undefined && body.website !== null && body.website !== '') {
    if (!isSafeHttpUrl(body.website, { maxLength: MAX_WEBSITE_URL_LEN })) {
      return next(createError('website must be a safe http(s) URL', 400));
    }
  }

  const allowed = ['displayName', 'bio', 'website', 'location', 'isPrivate', 'avatar'];
  allowed.forEach((field) => {
    if (body[field] !== undefined) {
      user[field] = body[field];
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

  const followeeId = req.params.id;
  const followerId = req.userId!;

  if (!followers[followeeId]) followers[followeeId] = new Set();
  if (!following[followerId]) following[followerId] = new Set();

  // Idempotent: re-following is a no-op (prevents notification spam DoS
  // and counter inflation). We still return 200 with the current state so
  // clients that retry on flaky networks see consistent results.
  if (followers[followeeId].has(followerId)) {
    return res.json({
      success: true,
      message: 'Already following',
      data: { followersCount: target.followersCount, alreadyFollowing: true },
    });
  }

  followers[followeeId].add(followerId);
  following[followerId].add(followeeId);
  target.followersCount = (target.followersCount || 0) + 1;
  const me = users[followerId];
  if (me) me.followingCount = (me.followingCount || 0) + 1;

  // Notify the followee. Self-follow is rejected above so this is always cross-user.
  createNotification(target.id, 'user.follow', followerId, 'started following you', target.id);

  res.json({
    success: true,
    message: 'Followed successfully',
    data: { followersCount: target.followersCount },
  });
});

// DELETE /api/users/:id/follow
router.delete(
  '/:id/follow',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const target = users[req.params.id];
    if (!target) return next(createError('User not found', 404));

    const followeeId = req.params.id;
    const followerId = req.userId!;

    // Only mutate counters if the relationship actually existed. The old
    // implementation decremented on every call, which let a client cap a
    // user's followersCount at 0 just by spamming DELETE.
    const had = followers[followeeId]?.delete(followerId);
    following[followerId]?.delete(followeeId);
    if (!had) {
      return res.json({
        success: true,
        message: 'Not following',
        data: { followersCount: target.followersCount, wasFollowing: false },
      });
    }

    target.followersCount = Math.max(0, (target.followersCount || 1) - 1);
    const me = users[followerId];
    if (me) me.followingCount = Math.max(0, (me.followingCount || 1) - 1);

    res.json({
      success: true,
      message: 'Unfollowed successfully',
      data: { followersCount: target.followersCount },
    });
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
