import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest,
  ConflictError,
  ForbiddenError,
  NotFoundError
} from '@ather/service-kit';

export type Role = 'owner' | 'admin' | 'moderator' | 'member';

export interface Community {
  id: string;
  slug: string;
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  createdAt: string;
}

export interface Membership {
  communityId: string;
  userId: string;
  role: Role;
  joinedAt: string;
}

export class CommunityStore {
  private communities: Community[] = [];
  private memberships: Membership[] = [];

  create(input: { slug: string; name: string; description?: string; ownerId: string; visibility: 'public' | 'private' }): Community {
    if (this.communities.find((c) => c.slug === input.slug)) {
      throw new ConflictError('slug already taken');
    }
    const c: Community = {
      id: uuidv4(),
      slug: input.slug,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      createdAt: new Date().toISOString()
    };
    this.communities.push(c);
    this.memberships.push({
      communityId: c.id,
      userId: input.ownerId,
      role: 'owner',
      joinedAt: c.createdAt
    });
    return c;
  }

  bySlug(slug: string): Community {
    const c = this.communities.find((x) => x.slug === slug);
    if (!c) throw new NotFoundError('community not found');
    return c;
  }

  join(communityId: string, userId: string): Membership {
    if (!this.communities.find((c) => c.id === communityId)) {
      throw new NotFoundError('community not found');
    }
    const existing = this.memberships.find(
      (m) => m.communityId === communityId && m.userId === userId
    );
    if (existing) return existing;
    const m: Membership = {
      communityId,
      userId,
      role: 'member',
      joinedAt: new Date().toISOString()
    };
    this.memberships.push(m);
    return m;
  }

  members(communityId: string): Membership[] {
    return this.memberships.filter((m) => m.communityId === communityId);
  }

  setRole(communityId: string, userId: string, role: Role, by: string): Membership {
    const actor = this.memberships.find(
      (m) => m.communityId === communityId && m.userId === by
    );
    if (!actor || (actor.role !== 'owner' && actor.role !== 'admin')) {
      throw new ForbiddenError('insufficient role');
    }
    const m = this.memberships.find(
      (x) => x.communityId === communityId && x.userId === userId
    );
    if (!m) throw new NotFoundError('member not found');
    m.role = role;
    return m;
  }
}

const CreateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_-]{3,32}$/),
  name: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
  visibility: z.enum(['public', 'private']).default('public')
});

const RoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['owner', 'admin', 'moderator', 'member'])
});

export function buildCommunitiesRouter(store: CommunityStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = CreateSchema.parse(req.body);
      const c = store.create({ ...input, ownerId: req.claims!.sub });
      res.status(201).json({ community: c });
    } catch (err) {
      next(err);
    }
  });

  router.get('/by-slug/:slug', limiters.read, (req, res, next) => {
    try {
      res.json({ community: store.bySlug(String(req.params.slug)) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/join', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const m = store.join(String(req.params.id), req.claims!.sub);
      res.status(201).json({ membership: m });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/members', limiters.read, (req, res) => {
    res.json({ members: store.members(String(req.params.id)) });
  });

  router.patch('/:id/members/role', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = RoleSchema.parse(req.body);
      const m = store.setRole(String(req.params.id), input.userId, input.role, req.claims!.sub);
      res.json({ membership: m });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
