import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { users } from './auth';
import { createError } from '../middleware/errorHandler';

const router = Router();

const conversations: Record<string, any> = {};
const messages: Record<string, any[]> = {}; // conversationId -> messages[]

// GET /api/messages/conversations
router.get('/conversations', authenticate, (req: AuthRequest, res: Response) => {
  const userConvos = Object.values(conversations)
    .filter((c: any) => c.participantIds.includes(req.userId!))
    .map((c: any) => ({
      ...c,
      participants: c.participantIds.map((id: string) => sanitizeUser(users[id])),
      lastMessage: (messages[c.id] || []).slice(-1)[0] || null,
      unreadCount: (messages[c.id] || []).filter(
        (m: any) => !m.isRead && m.senderId !== req.userId,
      ).length,
    }))
    .sort(
      (a: any, b: any) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

  res.json({ success: true, data: userConvos });
});

// POST /api/messages/conversations
router.post('/conversations', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const { participantId, type = 'direct', name } = req.body;

  // For direct chats, check if conversation already exists
  if (type === 'direct') {
    const existing = Object.values(conversations).find(
      (c: any) =>
        c.type === 'direct' &&
        c.participantIds.includes(req.userId!) &&
        c.participantIds.includes(participantId),
    );
    if (existing) {
      return res.json({
        success: true,
        data: { ...existing, participants: existing.participantIds.map((id: string) => sanitizeUser(users[id])) },
      });
    }
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const participantIds = type === 'direct' ? [req.userId!, participantId] : [req.userId!, ...(req.body.participantIds || [])];

  conversations[id] = { id, type, name: name || null, participantIds, createdAt: now, updatedAt: now };
  messages[id] = [];

  res.status(201).json({
    success: true,
    data: {
      ...conversations[id],
      participants: participantIds.map((uid: string) => sanitizeUser(users[uid])),
    },
  });
});

// GET /api/messages/conversations/:id
router.get('/conversations/:id', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const convo = conversations[req.params.id];
  if (!convo) return next(createError('Conversation not found', 404));
  if (!convo.participantIds.includes(req.userId!)) return next(createError('Forbidden', 403));

  const msgs = (messages[req.params.id] || []).slice(-50).map((m: any) => ({
    ...m,
    sender: sanitizeUser(users[m.senderId]),
  }));

  res.json({ success: true, data: { conversation: convo, messages: msgs } });
});

// POST /api/messages/conversations/:id/messages
router.post(
  '/conversations/:id/messages',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const convo = conversations[req.params.id];
    if (!convo) return next(createError('Conversation not found', 404));
    if (!convo.participantIds.includes(req.userId!)) return next(createError('Forbidden', 403));

    const { content, type = 'text', mediaUrl } = req.body;
    if (!content?.trim() && !mediaUrl) return next(createError('Message cannot be empty', 400));

    const msg = {
      id: uuidv4(),
      conversationId: req.params.id,
      senderId: req.userId!,
      type,
      content: content || '',
      mediaUrl: mediaUrl || null,
      isRead: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
    };

    messages[req.params.id].push(msg);
    convo.updatedAt = msg.createdAt;

    res.status(201).json({
      success: true,
      data: { ...msg, sender: sanitizeUser(users[req.userId!]) },
    });
  },
);

// PATCH /api/messages/conversations/:id/messages/:msgId/read
router.patch(
  '/conversations/:id/messages/:msgId/read',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const convo = conversations[req.params.id];
    if (!convo) return next(createError('Conversation not found', 404));
    if (!convo.participantIds.includes(req.userId!)) return next(createError('Forbidden', 403));

    const msg = (messages[req.params.id] || []).find((m: any) => m.id === req.params.msgId);
    if (!msg) return next(createError('Message not found', 404));

    msg.isRead = true;
    res.json({ success: true });
  },
);

function sanitizeUser(user: any) {
  if (!user) return null;
  const { password: _pw, email: _em, ...pub } = user;
  return pub;
}

export default router;
