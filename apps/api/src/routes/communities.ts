import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { users } from './auth';
import { createError } from '../middleware/errorHandler';

const router = Router();

const communities: Record<string, any> = {};
const memberships: Record<string, Set<string>> = {}; // communityId -> Set<userId>

// Seed a default community
const defaultId = 'community-general';
communities[defaultId] = {
  id: defaultId,
  name: 'General',
  slug: 'general',
  description: 'General discussion for all Ather users.',
  category: 'General',
  membersCount: 0,
  postsCount: 0,
  isPrivate: false,
  createdAt: new Date().toISOString(),
};
memberships[defaultId] = new Set();

// GET /api/communities
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  const data = Object.values(communities).map((c: any) => ({
    ...c,
    isMember: req.userId ? memberships[c.id]?.has(req.userId) || false : false,
  }));
  res.json({ success: true, data });
});

// POST /api/communities
router.post('/', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, description, category = 'General', isPrivate = false } = req.body;
  if (!name?.trim()) return next(createError('Community name is required', 400));

  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const existing = Object.values(communities).find((c: any) => c.slug === slug);
  if (existing) return next(createError('Community with this name already exists', 409));

  const id = uuidv4();
  communities[id] = {
    id,
    name: name.trim(),
    slug,
    description: description || '',
    category,
    membersCount: 1,
    postsCount: 0,
    isPrivate,
    creatorId: req.userId!,
    createdAt: new Date().toISOString(),
  };
  memberships[id] = new Set([req.userId!]);

  res.status(201).json({ success: true, data: { ...communities[id], isMember: true } });
});

// GET /api/communities/:slug
router.get('/:slug', optionalAuth, (req: AuthRequest, res: Response, next: NextFunction) => {
  const community = Object.values(communities).find((c: any) => c.slug === req.params.slug);
  if (!community) return next(createError('Community not found', 404));

  res.json({
    success: true,
    data: {
      ...community,
      isMember: req.userId ? memberships[community.id]?.has(req.userId) || false : false,
    },
  });
});

// POST /api/communities/:id/join
router.post('/:id/join', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const community = communities[req.params.id];
  if (!community) return next(createError('Community not found', 404));

  if (!memberships[req.params.id]) memberships[req.params.id] = new Set();
  memberships[req.params.id].add(req.userId!);
  community.membersCount = memberships[req.params.id].size;

  res.json({ success: true, message: 'Joined community' });
});

// DELETE /api/communities/:id/join
router.delete('/:id/join', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const community = communities[req.params.id];
  if (!community) return next(createError('Community not found', 404));

  memberships[req.params.id]?.delete(req.userId!);
  community.membersCount = memberships[req.params.id]?.size || 0;

  res.json({ success: true, message: 'Left community' });
});

export default router;
