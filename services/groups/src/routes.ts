import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest,
  NotFoundError
} from '@ather/service-kit';

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: string;
}

export class GroupStore {
  private groups: Group[] = [];
  create(ownerId: string, name: string): Group {
    const g: Group = {
      id: uuidv4(),
      name,
      ownerId,
      memberIds: [ownerId],
      createdAt: new Date().toISOString()
    };
    this.groups.push(g);
    return g;
  }
  get(id: string): Group {
    const g = this.groups.find((x) => x.id === id);
    if (!g) throw new NotFoundError('group not found');
    return g;
  }
  addMember(id: string, userId: string): Group {
    const g = this.get(id);
    if (!g.memberIds.includes(userId)) g.memberIds.push(userId);
    return g;
  }
}

const CreateSchema = z.object({ name: z.string().min(1).max(80) });
const AddSchema = z.object({ userId: z.string().min(1) });

export function buildGroupsRouter(store: GroupStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const { name } = CreateSchema.parse(req.body);
      res.status(201).json({ group: store.create(req.claims!.sub, name) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', limiters.read, (req, res, next) => {
    try {
      res.json({ group: store.get(String(req.params.id)) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/members', limiters.write, auth, (req, res, next) => {
    try {
      const { userId } = AddSchema.parse(req.body);
      res.json({ group: store.addMember(String(req.params.id), userId) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
