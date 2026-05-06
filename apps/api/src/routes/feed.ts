import { Router, Response } from 'express';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { posts } from './posts';
import { users } from './auth';

const router = Router();

/**
 * Scores a post for ranking. The score combines recency, engagement, and
 * lightweight tag-based personalization. Higher = more relevant. The function
 * is deterministic so feed tests are stable.
 */
function scorePost(post: any, viewerInterests: Set<string>): number {
  const ageHours = Math.max(0, (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000);
  // Half-life of ~24h, so recency decays smoothly
  const recency = 1 / (1 + ageHours / 24);
  const engagement =
    Math.log10(1 + (post.likesCount || 0)) * 1.5 +
    Math.log10(1 + (post.commentsCount || 0)) * 2 +
    Math.log10(1 + (post.sharesCount || 0)) * 1.2;
  const tagBoost =
    (post.tags || []).reduce(
      (acc: number, tag: string) => (viewerInterests.has(String(tag).toLowerCase()) ? acc + 1 : acc),
      0,
    ) * 0.5;
  // Reels get a small boost to mirror addictive short-video feeds.
  const typeBoost = post.type === 'reel' ? 0.3 : 0;
  return recency * 2 + engagement + tagBoost + typeBoost;
}

/**
 * GET /api/feed
 * Returns a personalized feed.
 *   - mode=ranked (default): AI-scored recommendation
 *   - mode=chronological: newest first
 *   - type=reel|post|story|...: filter by content type
 */
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const type = req.query.type as string | undefined;
  const mode = (req.query.mode as string) === 'chronological' ? 'chronological' : 'ranked';

  let allPosts = Object.values(posts).filter((p: any) => p.visibility === 'public');
  if (type) allPosts = allPosts.filter((p: any) => p.type === type);

  if (mode === 'chronological') {
    allPosts.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } else {
    const viewer = req.userId ? users[req.userId] : null;
    const interests: Set<string> = new Set(
      (viewer?.interests || []).map((t: string) => String(t).toLowerCase()),
    );
    allPosts.sort(
      (a: any, b: any) => scorePost(b, interests) - scorePost(a, interests),
    );
  }

  let startIndex = 0;
  if (cursor) {
    const idx = allPosts.findIndex((p: any) => p.id === cursor);
    startIndex = idx >= 0 ? idx + 1 : 0;
  }

  const page = allPosts.slice(startIndex, startIndex + limit);

  const enriched = page.map((p: any) => {
    const author = users[p.authorId];
    const { password: _pw, email: _em, ...safeAuthor } = author || {};
    return {
      ...p,
      author: safeAuthor,
      isLiked: false,
      isBookmarked: false,
    };
  });

  res.json({
    success: true,
    data: enriched,
    nextCursor: page.length === limit ? page[page.length - 1].id : null,
    hasMore: startIndex + limit < allPosts.length,
    mode,
  });
});

/**
 * GET /api/feed/trending
 * Returns posts sorted purely by engagement, useful for an Explore tab.
 */
router.get('/trending', optionalAuth, (_req: AuthRequest, res: Response) => {
  const ranked = Object.values(posts)
    .filter((p: any) => p.visibility === 'public')
    .sort(
      (a: any, b: any) =>
        (b.likesCount + b.commentsCount * 2 + b.sharesCount * 1.5) -
        (a.likesCount + a.commentsCount * 2 + a.sharesCount * 1.5),
    )
    .slice(0, 20)
    .map((p: any) => {
      const author = users[p.authorId];
      const { password: _pw, email: _em, ...safeAuthor } = author || {};
      return { ...p, author: safeAuthor };
    });

  res.json({ success: true, data: ranked });
});

export default router;
