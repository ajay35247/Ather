import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { requireJwtSecret } from '../middleware/auth';

export function registerSocketHandlers(io: Server): void {
  // Middleware: authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Authentication required'));

    try {
      const secret = requireJwtSecret();
      const payload = jwt.verify(token, secret) as { userId: string };
      (socket as any).userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId as string;
    socket.join(`user:${userId}`);

    // ── Messaging ──────────────────────────────────────────────────────────────
    socket.on('join:conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave:conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('message:send', (data: { conversationId: string; message: any }) => {
      io.to(`conversation:${data.conversationId}`).emit('message:new', data.message);
    });

    socket.on('message:typing', (data: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${data.conversationId}`).emit('message:typing', {
        userId,
        ...data,
      });
    });

    // ── Notifications ──────────────────────────────────────────────────────────
    socket.on('notification:subscribe', () => {
      socket.join(`notifications:${userId}`);
    });

    // ── Live streaming ─────────────────────────────────────────────────────────
    socket.on('live:start', (data: { streamId: string; title: string }) => {
      io.emit('live:new', { userId, ...data });
    });

    socket.on('live:end', (data: { streamId: string }) => {
      io.emit('live:ended', { userId, ...data });
    });

    socket.on('live:join', (data: { streamId: string }) => {
      socket.join(`stream:${data.streamId}`);
      socket.to(`stream:${data.streamId}`).emit('live:viewer_joined', { userId });
    });

    socket.on('live:chat', (data: { streamId: string; message: string }) => {
      io.to(`stream:${data.streamId}`).emit('live:chat_message', {
        userId,
        message: data.message,
        timestamp: new Date().toISOString(),
      });
    });

    // ── Presence ───────────────────────────────────────────────────────────────
    socket.broadcast.emit('user:online', { userId });

    socket.on('disconnect', () => {
      socket.broadcast.emit('user:offline', { userId });
    });
  });
}
