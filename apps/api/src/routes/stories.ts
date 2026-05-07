import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { users } from './auth';
import { createError } from '../middleware/errorHandler';
import { validateMediaUrls } from '../middleware/urlValidator';
import { createNotification } from './notifications';

/**
 * Stories — 24-hour ephemeral content (Instagram / Snapchat / WhatsApp /
 * Facebook / YouTube / X / LinkedIn pattern).
 *
 * A story has an `expiresAt` set to creation time + 24h. Reads filter out
 * expired stories lazily so we don't need a background sweeper for an
 * in-memory store. Replace the in-memory maps with Postgres in production.
 */

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_STORY_TEXT = 500;

const ALLOWED_TYPES = new Set(['image', 'video', 'text']);
const ALLOWED_REACTIONS = new Set(['❤️', '🔥', '😂', '😮', '😢', '👏']);

interface Story {
  id: string;
  authorId: string;
  type: 'image' | 'video' | 'text';
  text: string;
  mediaUrls: string[];
  backgroundColor?: string;
  createdAt: string;
  expiresAt: string;
  viewers: Set<string>;
  reactions: Record<string, string>; // userId -> emoji
}

// Object.create(null) prevents prototype pollution via __proto__ keys.
const stories: Record<string, Story> = Object.create(null);

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function isExpired(s: Story, now = Date.now()): boolean {
  return new Date(s.expiresAt).getTime() <= now;
}

function sanitizeAuthor(userId: string) {
  const u = users[userId];
  if (!u) return null;
  const { password: _pw, email: _em, ...pub } = u;
  return pub;
}

function publicStory(s: Story, viewerId?: string) {
  return {
    id: s.id,
    authorId: s.authorId,
    author: sanitizeAuthor(s.authorId),
    type: s.type,
    text: s.text,
    mediaUrls: s.mediaUrls,
    backgroundColor: s.backgroundColor,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    viewsCount: s.viewers.size,
    reactionsCount: Object.keys(s.reactions).length,
    isViewed: viewerId ? s.viewers.has(viewerId) : false,
    myReaction: viewerId ? s.reactions[viewerId] || null : null,
  };
}

function activeStories(now = Date.now()): Story[] {
  return Object.values(stories).filter((s) => !isExpired(s, now));
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/stories
 * Create a new story. Auto-expires 24 hours after creation.
 */
router.post('/', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const {
    type = 'image',
    text = '',
    mediaUrls = [],
    backgroundColor,
  } = req.body ?? {};

  if (!ALLOWED_TYPES.has(type)) {
    return next(createError('Invalid story type', 400));
  }

  if (typeof text !== 'string' || text.length > MAX_STORY_TEXT) {
    return next(createError(`Story text must be a string up to ${MAX_STORY_TEXT} chars`, 400));
  }

  // Text stories need text; image/video stories need media. Both can have text.
  if (type === 'text' && !text.trim()) {
    return next(createError('Text story requires text', 400));
  }
  if (type !== 'text' && (!Array.isArray(mediaUrls) || mediaUrls.length === 0)) {
    return next(createError('Image/video story requires at least one mediaUrl', 400));
  }

  let safeMediaUrls: string[] = [];
  if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
    try {
      // Limit to a single asset per story (Instagram / Snapchat convention).
      safeMediaUrls = validateMediaUrls(mediaUrls, { maxItems: 1 });
    } catch (e: any) {
      return next(createError(e?.message || 'Invalid mediaUrls', 400));
    }
  }

  const author = users[req.userId!];
  if (!author) return next(createError('User not found', 404));

  // Validate optional background color (hex like #RRGGBB or #RGB).
  if (
    backgroundColor !== undefined &&
    (typeof backgroundColor !== 'string' ||
      !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(backgroundColor))
  ) {
    return next(createError('Invalid backgroundColor', 400));
  }

  const id = uuidv4();
  const now = new Date();
  const story: Story = {
    id,
    authorId: req.userId!,
    type,
    text,
    mediaUrls: safeMediaUrls,
    backgroundColor,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + STORY_TTL_MS).toISOString(),
    viewers: new Set<string>(),
    reactions: Object.create(null),
  };
  stories[id] = story;

  res.status(201).json({ success: true, data: publicStory(story, req.userId) });
});

/**
 * GET /api/stories
 * List active stories grouped by author (Instagram-style rail).
 * Each entry contains the author and their newest-first list of active stories.
 */
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  const now = Date.now();
  const grouped: Record<string, Story[]> = Object.create(null);
  for (const s of activeStories(now)) {
    if (!grouped[s.authorId]) grouped[s.authorId] = [];
    grouped[s.authorId].push(s);
  }

  const data = Object.entries(grouped)
    .map(([authorId, authorStories]) => {
      authorStories.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return {
        authorId,
        author: sanitizeAuthor(authorId),
        hasUnviewed: req.userId
          ? authorStories.some((s) => !s.viewers.has(req.userId!))
          : true,
        stories: authorStories.map((s) => publicStory(s, req.userId)),
        latestAt: authorStories[0].createdAt,
      };
    })
    // Newest-first by latest story in the bucket.
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());

  res.json({ success: true, data });
});

/**
 * GET /api/stories/mine
 * The current user's own stories (active + recently expired in last hour
 * for the "recently expired" UX shown by Instagram/Snapchat).
 */
router.get('/mine', authenticate, (req: AuthRequest, res: Response) => {
  const now = Date.now();
  const mine = Object.values(stories)
    .filter((s) => s.authorId === req.userId)
    .filter((s) => now - new Date(s.expiresAt).getTime() < 60 * 60 * 1000) // active or <1h expired
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((s) => ({ ...publicStory(s, req.userId), isExpired: isExpired(s, now) }));

  res.json({ success: true, data: mine });
});

/**
 * GET /api/stories/:id
 * Fetch a single active story. Records a view if the caller is authenticated
 * and is not the author.
 */
router.get('/:id', optionalAuth, (req: AuthRequest, res: Response, next: NextFunction) => {
  const story = stories[req.params.id];
  if (!story || isExpired(story)) return next(createError('Story not found', 404));

  if (req.userId && req.userId !== story.authorId) {
    story.viewers.add(req.userId);
  }

  res.json({ success: true, data: publicStory(story, req.userId) });
});

/**
 * GET /api/stories/:id/views
 * Author-only list of users who viewed this story.
 */
router.get(
  '/:id/views',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const story = stories[req.params.id];
    if (!story) return next(createError('Story not found', 404));
    if (story.authorId !== req.userId) return next(createError('Forbidden', 403));

    const viewers = Array.from(story.viewers).map((uid) => sanitizeAuthor(uid)).filter(Boolean);
    res.json({
      success: true,
      data: { viewsCount: viewers.length, viewers },
    });
  },
);

/**
 * DELETE /api/stories/:id
 * Delete your own story before it expires.
 */
router.delete('/:id', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const story = stories[req.params.id];
  if (!story) return next(createError('Story not found', 404));
  if (story.authorId !== req.userId) return next(createError('Forbidden', 403));

  delete stories[req.params.id];
  res.json({ success: true, message: 'Story deleted' });
});

/**
 * POST /api/stories/:id/reactions
 * React to a story with a single emoji from a small allowed set.
 * Notifies the story author (silent on self-reactions).
 */
router.post(
  '/:id/reactions',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const story = stories[req.params.id];
    if (!story || isExpired(story)) return next(createError('Story not found', 404));

    const { emoji } = req.body ?? {};
    if (typeof emoji !== 'string' || !ALLOWED_REACTIONS.has(emoji)) {
      return next(createError('Invalid reaction emoji', 400));
    }

    story.reactions[req.userId!] = emoji;

    if (story.authorId !== req.userId) {
      createNotification(
        story.authorId,
        'story.react',
        req.userId!,
        `reacted ${emoji} to your story`,
        story.id,
      );
    }

    res.status(201).json({
      success: true,
      data: {
        myReaction: emoji,
        reactionsCount: Object.keys(story.reactions).length,
      },
    });
  },
);

/**
 * DELETE /api/stories/:id/reactions
 * Remove your reaction from a story.
 */
router.delete(
  '/:id/reactions',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const story = stories[req.params.id];
    if (!story || isExpired(story)) return next(createError('Story not found', 404));

    delete story.reactions[req.userId!];
    res.json({
      success: true,
      data: { reactionsCount: Object.keys(story.reactions).length },
    });
  },
);

// Test-only helper: clear in-memory store between suites without leaking
// internal types. Not exposed via HTTP.
export function _resetStoriesForTests(): void {
  for (const k of Object.keys(stories)) delete stories[k];
}

export { stories };
export default router;
