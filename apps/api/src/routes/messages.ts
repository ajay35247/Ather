import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { users } from './auth';
import { createError } from '../middleware/errorHandler';

const router = Router();

// In-memory message store (replace with DB in production)
// Object.create(null) prevents prototype pollution via __proto__ keys
const conversations: Record<string, any> = Object.create(null);
const messages: Record<string, any[]> = Object.create(null); // conversationId -> messages[]

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

// Cap on a single message's text. The 256kb global JSON limit is too coarse
// to bound an individual chat message; without this someone could store
// ~250kb messages that re-ship to every chat-list render.
const MAX_MESSAGE_CONTENT_LEN = 8_000;

// POST /api/messages/conversations
router.post('/conversations', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const { participantId, type = 'direct', name } = req.body || {};

  if (type !== 'direct' && type !== 'group') {
    return next(createError('type must be "direct" or "group"', 400));
  }

  // Direct chats: validate the single counterparty.
  if (type === 'direct') {
    if (typeof participantId !== 'string' || !participantId) {
      return next(createError('participantId is required for direct conversations', 400));
    }
    if (participantId === req.userId) {
      // Without this check a user could create thousands of "self chats"
      // and bloat the conversation list. Express the intent loudly.
      return next(createError('Cannot start a direct conversation with yourself', 400));
    }
    if (!users[participantId]) {
      return next(createError('participantId references a user that does not exist', 404));
    }
  }

  // Group chats: validate every additional participant. Reject duplicates,
  // self in the additional list, and unknown user ids.
  let extraIds: string[] = [];
  if (type === 'group') {
    const raw = req.body?.participantIds;
    if (!Array.isArray(raw) || raw.length === 0) {
      return next(createError('participantIds must be a non-empty array for groups', 400));
    }
    if (raw.length > 100) {
      return next(createError('group conversations support at most 100 participants', 400));
    }
    const seen = new Set<string>();
    for (const id of raw) {
      if (typeof id !== 'string' || !id) {
        return next(createError('participantIds entries must be strings', 400));
      }
      if (id === req.userId) continue; // creator is implicitly added
      if (seen.has(id)) continue;
      if (!users[id]) {
        return next(createError(`participantIds contains unknown user: ${id}`, 404));
      }
      seen.add(id);
      extraIds.push(id);
    }
    if (extraIds.length === 0) {
      return next(createError('group requires at least one other participant', 400));
    }
  }

  // Optional group name.
  if (name !== undefined && name !== null) {
    if (typeof name !== 'string' || name.length > 120) {
      return next(createError('name must be a string up to 120 characters', 400));
    }
  }

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
  const participantIds = type === 'direct' ? [req.userId!, participantId] : [req.userId!, ...extraIds];

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
    if (content !== undefined && content !== null && typeof content !== 'string') {
      return next(createError('content must be a string', 400));
    }
    if (typeof content === 'string' && content.length > MAX_MESSAGE_CONTENT_LEN) {
      return next(createError(`content exceeds ${MAX_MESSAGE_CONTENT_LEN} characters`, 400));
    }
    if (!content?.trim() && !mediaUrl) return next(createError('Message cannot be empty', 400));

    // Validate mediaUrl to prevent javascript: or data: URI XSS
    if (mediaUrl) {
      try {
        const parsed = new URL(mediaUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return next(createError('mediaUrl must use http or https', 400));
        }
      } catch {
        return next(createError('mediaUrl must be a valid URL', 400));
      }
    }

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
