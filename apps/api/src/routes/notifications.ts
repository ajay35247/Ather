import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = Router();

// In-memory notification store (replace with DB in production)
// Object.create(null) prevents prototype pollution via __proto__ keys
const notifications: Record<string, any[]> = Object.create(null);

// Per-user retention cap. Notifications older than this are pruned LIFO when
// new ones arrive — prevents unbounded memory growth from a chatty actor.
const MAX_PER_USER = 100;

// Default and ceiling for GET pagination. The previous implementation
// returned the entire backlog (up to 100) on every poll which is wasteful
// once the unread badge is the only thing the client cares about.
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function createNotification(
  userId: string,
  type: string,
  actorId: string,
  message: string,
  targetId?: string,
) {
  if (!notifications[userId]) notifications[userId] = [];
  notifications[userId].unshift({
    id: uuidv4(),
    type,
    actorId,
    targetId,
    message,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
  // Keep only most-recent N
  notifications[userId] = notifications[userId].slice(0, MAX_PER_USER);
}

// GET /api/notifications?limit=20&cursor=<id>&unread=true
// Cursor pagination over the user's LIFO list. `unread=true` filters to
// only unread items (useful for the bell badge / dedicated unread inbox).
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const all = notifications[req.userId!] || [];
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const unreadOnly = req.query.unread === 'true' || req.query.unread === '1';

  const filtered = unreadOnly ? all.filter((n: any) => !n.isRead) : all;

  let startIndex = 0;
  if (cursor) {
    const idx = filtered.findIndex((n: any) => n.id === cursor);
    startIndex = idx >= 0 ? idx + 1 : 0;
  }
  const page = filtered.slice(startIndex, startIndex + limit);
  const nextCursor =
    page.length === limit && startIndex + limit < filtered.length
      ? page[page.length - 1].id
      : null;

  res.json({
    success: true,
    data: page,
    nextCursor,
    hasMore: nextCursor !== null,
  });
});

// GET /api/notifications/unread-count
// Cheap O(n) sweep so the UI can render the badge without paginating.
router.get('/unread-count', authenticate, (req: AuthRequest, res: Response) => {
  const count = (notifications[req.userId!] || []).filter((n: any) => !n.isRead).length;
  res.json({ success: true, data: { count } });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const notif = (notifications[req.userId!] || []).find((n: any) => n.id === req.params.id);
  if (!notif) return next(createError('Notification not found', 404));
  notif.isRead = true;
  res.json({ success: true });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', authenticate, (req: AuthRequest, res: Response) => {
  (notifications[req.userId!] || []).forEach((n: any) => {
    n.isRead = true;
  });
  res.json({ success: true });
});

// DELETE /api/notifications/:id
router.delete('/:id', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const list = notifications[req.userId!] || [];
  const idx = list.findIndex((n: any) => n.id === req.params.id);
  if (idx < 0) return next(createError('Notification not found', 404));
  list.splice(idx, 1);
  res.json({ success: true });
});

export default router;
