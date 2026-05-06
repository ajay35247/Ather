import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  paginateNewestFirst,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest,
  ForbiddenError,
  NotFoundError
} from '@ather/service-kit';

export type ConversationKind = 'dm' | 'group' | 'channel';

export interface Conversation {
  id: string;
  kind: ConversationKind;
  memberIds: string[];
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  /** Server stores ciphertext only — see docs/security.md (Signal protocol). */
  ciphertext: string;
  mediaId?: string;
  createdAt: string;
}

export class ChatStore {
  private conversations: Conversation[] = [];
  private messages: Message[] = [];

  createConversation(kind: ConversationKind, memberIds: string[]): Conversation {
    const c: Conversation = {
      id: uuidv4(),
      kind,
      memberIds: [...new Set(memberIds)],
      createdAt: new Date().toISOString()
    };
    this.conversations.push(c);
    return c;
  }

  getConversation(id: string): Conversation {
    const c = this.conversations.find((x) => x.id === id);
    if (!c) throw new NotFoundError('conversation not found');
    return c;
  }

  conversationsFor(userId: string): Conversation[] {
    return this.conversations.filter((c) => c.memberIds.includes(userId));
  }

  send(conversationId: string, senderId: string, ciphertext: string, mediaId?: string): Message {
    const conv = this.getConversation(conversationId);
    if (!conv.memberIds.includes(senderId)) {
      throw new ForbiddenError('not a member');
    }
    const m: Message = {
      id: uuidv4(),
      conversationId,
      senderId,
      ciphertext,
      mediaId,
      createdAt: new Date().toISOString()
    };
    this.messages.push(m);
    return m;
  }

  messagesIn(conversationId: string, viewerId: string): Message[] {
    const conv = this.getConversation(conversationId);
    if (!conv.memberIds.includes(viewerId)) {
      throw new ForbiddenError('not a member');
    }
    return this.messages.filter((m) => m.conversationId === conversationId);
  }
}

const CreateConvSchema = z.object({
  kind: z.enum(['dm', 'group', 'channel']),
  memberIds: z.array(z.string().min(1)).min(1).max(500)
});

const SendSchema = z.object({
  ciphertext: z.string().min(1).max(64 * 1024),
  mediaId: z.string().uuid().optional()
});

export function buildChatRouter(store: ChatStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/conversations', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = CreateConvSchema.parse(req.body);
      // Caller must include themselves.
      const members = [...new Set([req.claims!.sub, ...input.memberIds])];
      const c = store.createConversation(input.kind, members);
      res.status(201).json({ conversation: c });
    } catch (err) {
      next(err);
    }
  });

  router.get('/conversations', limiters.read, auth, (req: AuthedRequest, res) => {
    res.json({ conversations: store.conversationsFor(req.claims!.sub) });
  });

  router.post(
    '/conversations/:id/messages',
    limiters.write,
    auth,
    (req: AuthedRequest, res, next) => {
      try {
        const input = SendSchema.parse(req.body);
        const m = store.send(
          String(req.params.id),
          req.claims!.sub,
          input.ciphertext,
          input.mediaId
        );
        res.status(201).json({ message: m });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/conversations/:id/messages',
    limiters.read,
    auth,
    (req: AuthedRequest, res, next) => {
      try {
        const limit = Math.min(Number(req.query.limit ?? 50), 200);
        const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
        const all = store.messagesIn(String(req.params.id), req.claims!.sub);
        res.json(paginateNewestFirst(all, cursor, limit));
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
