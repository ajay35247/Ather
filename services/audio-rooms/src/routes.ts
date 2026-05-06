import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest,
  ForbiddenError,
  NotFoundError
} from '@ather/service-kit';

export interface Room {
  id: string;
  hostId: string;
  topic: string;
  status: 'open' | 'closed';
  speakers: string[];
  listeners: string[];
  createdAt: string;
}

export class RoomStore {
  private items: Room[] = [];
  create(hostId: string, topic: string): Room {
    const r: Room = {
      id: uuidv4(),
      hostId,
      topic,
      status: 'open',
      speakers: [hostId],
      listeners: [],
      createdAt: new Date().toISOString()
    };
    this.items.push(r);
    return r;
  }
  join(id: string, userId: string): Room {
    const r = this.items.find((x) => x.id === id);
    if (!r) throw new NotFoundError('room not found');
    if (r.status === 'closed') throw new ForbiddenError('room closed');
    if (!r.listeners.includes(userId) && !r.speakers.includes(userId)) {
      r.listeners.push(userId);
    }
    return r;
  }
  close(id: string, by: string): Room {
    const r = this.items.find((x) => x.id === id);
    if (!r) throw new NotFoundError('room not found');
    if (r.hostId !== by) throw new ForbiddenError('not host');
    r.status = 'closed';
    return r;
  }
  open(): Room[] {
    return this.items.filter((r) => r.status === 'open');
  }
}

const CreateSchema = z.object({ topic: z.string().min(1).max(200) });

export function buildAudioRoomsRouter(store: RoomStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const { topic } = CreateSchema.parse(req.body);
      res.status(201).json({ room: store.create(req.claims!.sub, topic) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/join', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      res.json({ room: store.join(String(req.params.id), req.claims!.sub) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/close', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      res.json({ room: store.close(String(req.params.id), req.claims!.sub) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/open', limiters.read, (_req, res) => {
    res.json({ items: store.open() });
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
