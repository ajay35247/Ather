import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';

import authRouter from './routes/auth';
import usersRouter from './routes/users';
import postsRouter from './routes/posts';
import messagesRouter from './routes/messages';
import communitiesRouter from './routes/communities';
import notificationsRouter from './routes/notifications';
import feedRouter from './routes/feed';
import aiRouter from './routes/ai';
import monetizationRouter from './routes/monetization';
import liveRouter from './routes/live';
import miniAppsRouter from './routes/miniapps';
import identityRouter from './routes/identity';
import wellbeingRouter from './routes/wellbeing';
import { errorHandler } from './middleware/errorHandler';
import { makeLimiter } from './middleware/rateLimits';
import { registerSocketHandlers } from './socket/handlers';

// Read version without breaking tsc rootDir constraints.
const version = process.env.npm_package_version || '1.0.0';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// ── Trust proxy ──────────────────────────────────────────────────────────────
// Required when running behind a load balancer / CDN (Cloudflare, AWS ALB,
// nginx) so `req.ip` reflects the real client and rate-limits are effective.
// Configurable for safety: prod typically wants `1` (one trusted hop).
const TRUST_PROXY = process.env.TRUST_PROXY ?? '1';
app.set('trust proxy', /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY);

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
});
registerSocketHandlers(io);

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  }),
);

// Smaller global JSON limit. The previous 10MB applied to *every* endpoint
// (including /auth/login), making slowloris-style memory DoS trivial.
// Endpoints that genuinely need larger bodies (media upload) should be
// proxied direct-to-S3 with presigned URLs in production.
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// Global safety-net limiter; per-route limiters in routes/* are stricter.
const globalLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: 'Too many requests',
});
app.use(globalLimiter);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/posts', postsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/communities', communitiesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/feed', feedRouter);
app.use('/api/ai', aiRouter);
app.use('/api/monetization', monetizationRouter);
app.use('/api/live', liveRouter);
app.use('/api/mini-apps', miniAppsRouter);
app.use('/api/identity', identityRouter);
app.use('/api/wellbeing', wellbeingRouter);

// ── Health probes ────────────────────────────────────────────────────────────
// Split per Kubernetes conventions:
//   /livez   process is alive (used for restarts)
//   /readyz  process is ready to receive traffic (deps reachable)
//   /health  legacy combined endpoint (kept for backwards compatibility)
const startedAt = Date.now();

app.get('/livez', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/readyz', (_req, res) => {
  // When DB / Redis are wired, gate this on real dependency probes.
  res.json({ status: 'ok' });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version,
    uptimeMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV !== 'test') {
  const server = httpServer.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Ather API listening on http://localhost:${PORT} (v${version})`);
  });

  // Graceful shutdown: stop accepting new connections, let in-flight finish,
  // close Socket.IO last. Without this, K8s SIGTERM kills active requests.
  const shutdown = (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`${signal} received — shutting down gracefully`);
    io.close(() => {
      server.close(() => process.exit(0));
    });
    // Hard cap so we don't hang a pod forever.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export { app, io };
