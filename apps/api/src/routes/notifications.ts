import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// In-memory notification store (replace with DB in production)
// Object.create(null) prevents prototype pollution via __proto__ keys
const notifications: Record<string, any[]> = Object.create(null);

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
  // Keep only last 100
  notifications[userId] = notifications[userId].slice(0, 100);
}

// GET /api/notifications
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const userNotifs = notifications[req.userId!] || [];
  res.json({ success: true, data: userNotifs });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, (req: AuthRequest, res: Response) => {
  const notif = (notifications[req.userId!] || []).find((n: any) => n.id === req.params.id);
  if (notif) notif.isRead = true;
  res.json({ success: true });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', authenticate, (req: AuthRequest, res: Response) => {
  (notifications[req.userId!] || []).forEach((n: any) => {
    n.isRead = true;
  });
  res.json({ success: true });
});

export default router;
