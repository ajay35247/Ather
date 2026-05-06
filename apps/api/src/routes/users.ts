import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { users } from './auth';
import { createError } from '../middleware/errorHandler';
import { createNotification } from './notifications';

const router = Router();

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
