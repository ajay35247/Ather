import { Router, Response } from 'express';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { posts } from './posts';
import { users } from './auth';

const router = Router();

/**
 * GET /api/feed
 * Returns a personalized feed. Simple implementation:
 * - Authenticated: returns a mix of recent posts
 * - Unauthenticated: returns the most recent public posts
 */
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const type = req.query.type as string | undefined; // 'reel' | 'post' | 'story' etc.

  let allPosts = Object.values(posts)
    .filter((p: any) => p.visibility === 'public')
    .sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  if (type) allPosts = allPosts.filter((p: any) => p.type === type);

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
  });
});

export default router;
