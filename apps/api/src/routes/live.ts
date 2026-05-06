import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { users } from './auth';

const router = Router();

/**
 * Live streaming module — Phase 3
 * Tracks live broadcasts in-memory. Real implementation would integrate with
 * an RTMP/WebRTC service (Mux, Agora, AWS IVS) and persist sessions in DB.
 */

interface LiveStream {
  id: string;
  hostId: string;
  title: string;
  description: string;
  category: string;
  status: 'live' | 'ended';
  viewerCount: number;
  startedAt: string;
  endedAt?: string;
  // Names of viewers currently in the stream.
  viewers: Set<string>;
}

const streams: Record<string, LiveStream> = Object.create(null);

function publicStream(s: LiveStream) {
  const host = users[s.hostId];
  const safeHost = host
    ? { id: host.id, username: host.username, displayName: host.displayName, avatarUrl: host.avatarUrl }
    : null;
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    category: s.category,
    status: s.status,
    viewerCount: s.viewerCount,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    host: safeHost,
  };
}

// ── POST /api/live ───────────────────────────────────────────────────────────
router.post('/', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, description = '', category = 'general' } = req.body as {
    title?: string;
    description?: string;
    category?: string;
  };
  if (!title?.trim()) return next(createError('title is required', 400));
  if (title.length > 200) return next(createError('title too long', 400));

  const id = uuidv4();
  const stream: LiveStream = {
    id,
    hostId: req.userId!,
    title: title.trim(),
    description: String(description).slice(0, 1000),
    category: String(category).slice(0, 64),
    status: 'live',
    viewerCount: 0,
    startedAt: new Date().toISOString(),
    viewers: new Set(),
  };
  streams[id] = stream;
  res.status(201).json({ success: true, data: publicStream(stream) });
});

// ── GET /api/live ────────────────────────────────────────────────────────────
router.get('/', optionalAuth, (_req: AuthRequest, res: Response) => {
  const live = Object.values(streams)
    .filter((s) => s.status === 'live')
    .sort((a, b) => b.viewerCount - a.viewerCount)
    .map(publicStream);
  res.json({ success: true, data: live });
});

// ── GET /api/live/:id ────────────────────────────────────────────────────────
router.get('/:id', optionalAuth, (req: AuthRequest, res: Response, next: NextFunction) => {
  const s = streams[req.params.id];
  if (!s) return next(createError('Stream not found', 404));
  res.json({ success: true, data: publicStream(s) });
});

// ── POST /api/live/:id/join ──────────────────────────────────────────────────
router.post(
  '/:id/join',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const s = streams[req.params.id];
    if (!s) return next(createError('Stream not found', 404));
    if (s.status !== 'live') return next(createError('Stream has ended', 410));
    if (!s.viewers.has(req.userId!)) {
      s.viewers.add(req.userId!);
      s.viewerCount = s.viewers.size;
    }
    res.json({ success: true, data: publicStream(s) });
  },
);

// ── POST /api/live/:id/leave ─────────────────────────────────────────────────
router.post(
  '/:id/leave',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const s = streams[req.params.id];
    if (!s) return next(createError('Stream not found', 404));
    if (s.viewers.delete(req.userId!)) s.viewerCount = s.viewers.size;
    res.json({ success: true, data: publicStream(s) });
  },
);

// ── POST /api/live/:id/end ───────────────────────────────────────────────────
router.post('/:id/end', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const s = streams[req.params.id];
  if (!s) return next(createError('Stream not found', 404));
  if (s.hostId !== req.userId) return next(createError('Forbidden', 403));
  s.status = 'ended';
  s.endedAt = new Date().toISOString();
  s.viewers.clear();
  s.viewerCount = 0;
  res.json({ success: true, data: publicStream(s) });
});

export default router;
