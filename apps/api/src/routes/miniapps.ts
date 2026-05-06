import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = Router();

/**
 * Mini-apps registry — Phase 4
 *
 * Curated catalog of in-platform mini-apps (WeChat-style ecosystem) that
 * users can install. The catalog is static; per-user installs are stored
 * in-memory.
 */

interface MiniApp {
  id: string;
  name: string;
  description: string;
  category: 'productivity' | 'creator' | 'commerce' | 'social' | 'utility';
  icon: string;
  version: string;
  /** Permissions required to run. Surfaced to user on install. */
  permissions: string[];
}

const CATALOG: MiniApp[] = [
  {
    id: 'polls',
    name: 'Polls & Surveys',
    description: 'Create live polls and surveys for your audience.',
    category: 'social',
    icon: '📊',
    version: '1.0.0',
    permissions: ['post.create', 'feed.read'],
  },
  {
    id: 'creator-studio',
    name: 'Creator Studio',
    description: 'Schedule posts, analyze performance, manage monetization.',
    category: 'creator',
    icon: '🎬',
    version: '1.2.0',
    permissions: ['post.create', 'post.read', 'monetization.read'],
  },
  {
    id: 'shop',
    name: 'Ather Shop',
    description: 'Sell physical and digital products from your profile.',
    category: 'commerce',
    icon: '🛍️',
    version: '0.9.0',
    permissions: ['profile.write', 'monetization.write'],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'Schedule meetings and events with your network.',
    category: 'productivity',
    icon: '📅',
    version: '1.0.0',
    permissions: ['profile.read', 'messages.write'],
  },
  {
    id: 'translator',
    name: 'Live Translator',
    description: 'Real-time translation in chats and live streams.',
    category: 'utility',
    icon: '🌐',
    version: '1.1.0',
    permissions: ['messages.read', 'messages.write'],
  },
  {
    id: 'jobs',
    name: 'Jobs Board',
    description: 'Post and find jobs in your network.',
    category: 'productivity',
    icon: '💼',
    version: '1.0.0',
    permissions: ['profile.read', 'post.create'],
  },
];

// userId -> Set<appId>
const installs: Record<string, Set<string>> = Object.create(null);

// ── GET /api/mini-apps ───────────────────────────────────────────────────────
router.get('/', (_req, res: Response) => {
  res.json({ success: true, data: CATALOG });
});

// ── GET /api/mini-apps/installed ─────────────────────────────────────────────
router.get('/installed', authenticate, (req: AuthRequest, res: Response) => {
  const set = installs[req.userId!] || new Set<string>();
  const mine = CATALOG.filter((a) => set.has(a.id));
  res.json({ success: true, data: mine });
});

// ── POST /api/mini-apps/:id/install ──────────────────────────────────────────
router.post(
  '/:id/install',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const app = CATALOG.find((a) => a.id === req.params.id);
    if (!app) return next(createError('Mini-app not found', 404));
    if (!installs[req.userId!]) installs[req.userId!] = new Set();
    installs[req.userId!].add(app.id);
    res.json({ success: true, data: app });
  },
);

// ── DELETE /api/mini-apps/:id/install ────────────────────────────────────────
router.delete(
  '/:id/install',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const app = CATALOG.find((a) => a.id === req.params.id);
    if (!app) return next(createError('Mini-app not found', 404));
    installs[req.userId!]?.delete(app.id);
    res.json({ success: true });
  },
);

export default router;
