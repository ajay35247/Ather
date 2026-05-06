import { Router } from 'express';
import { z } from 'zod';
import {
  defaultLimiters,
  paginateNewestFirst,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest,
  ConflictError,
  ForbiddenError
} from '@ather/service-kit';

interface FollowRecord {
  id: string;
  followerId: string;
  followeeId: string;
  createdAt: string;
}

interface BlockRecord {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export class GraphStore {
  private follows: FollowRecord[] = [];
  private blocks: BlockRecord[] = [];

  follow(followerId: string, followeeId: string): FollowRecord {
    if (followerId === followeeId) {
      throw new ConflictError('cannot follow self');
    }
    if (this.isBlocked(followerId, followeeId) || this.isBlocked(followeeId, followerId)) {
      throw new ForbiddenError('blocked');
    }
    const existing = this.follows.find(
      (f) => f.followerId === followerId && f.followeeId === followeeId
    );
    if (existing) return existing;
    const rec: FollowRecord = {
      id: `${followerId}->${followeeId}`,
      followerId,
      followeeId,
      createdAt: new Date().toISOString()
    };
    this.follows.push(rec);
    return rec;
  }

  unfollow(followerId: string, followeeId: string): boolean {
    const before = this.follows.length;
    this.follows = this.follows.filter(
      (f) => !(f.followerId === followerId && f.followeeId === followeeId)
    );
    return this.follows.length < before;
  }

  block(blockerId: string, blockedId: string): BlockRecord {
    if (blockerId === blockedId) {
      throw new ConflictError('cannot block self');
    }
    // Blocking implies unfollow both ways.
    this.unfollow(blockerId, blockedId);
    this.unfollow(blockedId, blockerId);
    const existing = this.blocks.find(
      (b) => b.blockerId === blockerId && b.blockedId === blockedId
    );
    if (existing) return existing;
    const rec: BlockRecord = {
      id: `${blockerId}!${blockedId}`,
      blockerId,
      blockedId,
      createdAt: new Date().toISOString()
    };
    this.blocks.push(rec);
    return rec;
  }

  isBlocked(blockerId: string, blockedId: string): boolean {
    return this.blocks.some((b) => b.blockerId === blockerId && b.blockedId === blockedId);
  }

  followers(userId: string): FollowRecord[] {
    return this.follows.filter((f) => f.followeeId === userId);
  }

  following(userId: string): FollowRecord[] {
    return this.follows.filter((f) => f.followerId === userId);
  }

  reset(): void {
    this.follows = [];
    this.blocks = [];
  }
}

const TargetSchema = z.object({ userId: z.string().min(1) });

export function buildSocialRouter(store: GraphStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/follow', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const { userId } = TargetSchema.parse(req.body);
      const rec = store.follow(req.claims!.sub, userId);
      res.status(201).json({ follow: rec });
    } catch (err) {
      next(err);
    }
  });

  router.post('/unfollow', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const { userId } = TargetSchema.parse(req.body);
      const removed = store.unfollow(req.claims!.sub, userId);
      res.json({ removed });
    } catch (err) {
      next(err);
    }
  });

  router.post('/block', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const { userId } = TargetSchema.parse(req.body);
      const rec = store.block(req.claims!.sub, userId);
      res.status(201).json({ block: rec });
    } catch (err) {
      next(err);
    }
  });

  router.get('/followers/:userId', limiters.read, (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const all = store.followers(String(req.params.userId));
    res.json(paginateNewestFirst(all, cursor, limit));
  });

  router.get('/following/:userId', limiters.read, (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const all = store.following(String(req.params.userId));
    res.json(paginateNewestFirst(all, cursor, limit));
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
