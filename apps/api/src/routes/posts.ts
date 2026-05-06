import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { users } from './auth';
import { createError } from '../middleware/errorHandler';
import { validateMediaUrls } from '../middleware/urlValidator';

const router = Router();

// In-memory posts store (replace with DB in production)
// Object.create(null) prevents prototype pollution via __proto__ keys
const posts: Record<string, any> = Object.create(null);
const likedPosts: Record<string, Set<string>> = Object.create(null); // postId -> Set<userId>
const bookmarks: Record<string, Set<string>> = Object.create(null);  // userId -> Set<postId>

// GET /api/posts (paginated)
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const authorId = req.query.authorId as string | undefined;

  let allPosts = Object.values(posts).sort(
    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (authorId) allPosts = allPosts.filter((p: any) => p.authorId === authorId);

  let startIndex = 0;
  if (cursor) {
    const idx = allPosts.findIndex((p: any) => p.id === cursor);
    startIndex = idx >= 0 ? idx + 1 : 0;
  }

  const page = allPosts.slice(startIndex, startIndex + limit);
  const enriched = page.map((p: any) => enrichPost(p, req.userId));

  res.json({
    success: true,
    data: enriched,
    nextCursor: page.length === limit ? page[page.length - 1].id : null,
    hasMore: startIndex + limit < allPosts.length,
  });
});

// POST /api/posts
router.post('/', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const { content, type = 'text', mediaUrls = [], tags = [], visibility = 'public' } = req.body;
  if (!content && (!Array.isArray(mediaUrls) || mediaUrls.length === 0)) {
    return next(createError('Post must have content or media', 400));
  }

  // Reject `javascript:`, `data:`, internal-network, and userinfo-bearing URLs
  // before they ever reach the feed renderer (XSS/SSRF defense). Default
  // `maxItems` (10) is enforced by the helper.
  let safeMediaUrls: string[];
  try {
    safeMediaUrls = validateMediaUrls(mediaUrls);
  } catch (e: any) {
    return next(createError(e?.message || 'Invalid mediaUrls', 400));
  }

  const author = users[req.userId!];
  if (!author) return next(createError('User not found', 404));

  const id = uuidv4();
  const now = new Date().toISOString();
  posts[id] = {
    id,
    authorId: req.userId!,
    type,
    content: content || '',
    mediaUrls: safeMediaUrls,
    tags,
    visibility,
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    comments: [],
    createdAt: now,
  };

  author.postsCount = (author.postsCount || 0) + 1;
  res.status(201).json({ success: true, data: enrichPost(posts[id], req.userId) });
});

// GET /api/posts/:id
router.get('/:id', optionalAuth, (req: AuthRequest, res: Response, next: NextFunction) => {
  const post = posts[req.params.id];
  if (!post) return next(createError('Post not found', 404));
  res.json({ success: true, data: enrichPost(post, req.userId) });
});

// DELETE /api/posts/:id
router.delete('/:id', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const post = posts[req.params.id];
  if (!post) return next(createError('Post not found', 404));
  if (post.authorId !== req.userId) return next(createError('Forbidden', 403));

  delete posts[req.params.id];
  const author = users[req.userId!];
  if (author) author.postsCount = Math.max(0, (author.postsCount || 1) - 1);

  res.json({ success: true, message: 'Post deleted' });
});

// POST /api/posts/:id/like
router.post('/:id/like', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const post = posts[req.params.id];
  if (!post) return next(createError('Post not found', 404));

  if (!likedPosts[post.id]) likedPosts[post.id] = new Set();
  if (likedPosts[post.id].has(req.userId!)) {
    return next(createError('Already liked', 409));
  }

  likedPosts[post.id].add(req.userId!);
  post.likesCount += 1;
  res.json({ success: true, data: { likesCount: post.likesCount } });
});

// DELETE /api/posts/:id/like
router.delete('/:id/like', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const post = posts[req.params.id];
  if (!post) return next(createError('Post not found', 404));

  likedPosts[post.id]?.delete(req.userId!);
  post.likesCount = Math.max(0, post.likesCount - 1);
  res.json({ success: true, data: { likesCount: post.likesCount } });
});

// POST /api/posts/:id/comments
router.post(
  '/:id/comments',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const post = posts[req.params.id];
    if (!post) return next(createError('Post not found', 404));

    const { content } = req.body;
    if (!content?.trim()) return next(createError('Comment cannot be empty', 400));

    const author = users[req.userId!];
    const comment = {
      id: uuidv4(),
      author: sanitizeUser(author),
      content,
      likesCount: 0,
      isLiked: false,
      createdAt: new Date().toISOString(),
    };

    post.comments.push(comment);
    post.commentsCount += 1;
    res.status(201).json({ success: true, data: comment });
  },
);

// GET /api/posts/:id/comments
router.get('/:id/comments', optionalAuth, (req: AuthRequest, res: Response, next: NextFunction) => {
  const post = posts[req.params.id];
  if (!post) return next(createError('Post not found', 404));
  res.json({ success: true, data: post.comments });
});

// POST /api/posts/:id/bookmark
router.post(
  '/:id/bookmark',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!posts[req.params.id]) return next(createError('Post not found', 404));
    if (!bookmarks[req.userId!]) bookmarks[req.userId!] = new Set();
    bookmarks[req.userId!].add(req.params.id);
    res.json({ success: true });
  },
);

// Helpers
function sanitizeUser(user: any) {
  if (!user) return null;
  const { password: _pw, email: _em, ...pub } = user;
  return pub;
}

function enrichPost(post: any, userId?: string) {
  const author = sanitizeUser(users[post.authorId]);
  return {
    ...post,
    author,
    isLiked: userId ? likedPosts[post.id]?.has(userId) || false : false,
    isBookmarked: userId ? bookmarks[userId]?.has(post.id) || false : false,
  };
}

export { posts };
export default router;
