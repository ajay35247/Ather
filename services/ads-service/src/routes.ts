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

export interface Campaign {
  id: string;
  advertiserId: string;
  name: string;
  /** Daily budget in minor units. */
  dailyBudget: number;
  status: 'draft' | 'active' | 'paused';
  /** Targeting criteria — kept abstract for Phase 3 stub. */
  targeting: { topics?: string[]; geos?: string[] };
  createdAt: string;
}

export class CampaignStore {
  private items: Campaign[] = [];
  create(advertiserId: string, input: Omit<Campaign, 'id' | 'advertiserId' | 'status' | 'createdAt'>): Campaign {
    const c: Campaign = {
      id: uuidv4(),
      advertiserId,
      status: 'draft',
      createdAt: new Date().toISOString(),
      ...input
    };
    this.items.push(c);
    return c;
  }
  setStatus(id: string, by: string, status: 'active' | 'paused' | 'draft'): Campaign {
    const c = this.items.find((x) => x.id === id);
    if (!c) throw new NotFoundError('campaign not found');
    if (c.advertiserId !== by) throw new ForbiddenError('not advertiser');
    c.status = status;
    return c;
  }
  byAdvertiser(advertiserId: string): Campaign[] {
    return this.items.filter((c) => c.advertiserId === advertiserId);
  }
}

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  dailyBudget: z.number().int().positive().max(1_000_000_000),
  targeting: z
    .object({
      topics: z.array(z.string().min(1).max(64)).max(50).optional(),
      geos: z.array(z.string().length(2)).max(50).optional()
    })
    .default({})
});

const StatusSchema = z.object({ status: z.enum(['draft', 'active', 'paused']) });

export function buildAdsRouter(store: CampaignStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/campaigns', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = CreateSchema.parse(req.body);
      res.status(201).json({ campaign: store.create(req.claims!.sub, input) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/campaigns/:id', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const { status } = StatusSchema.parse(req.body);
      res.json({ campaign: store.setStatus(String(req.params.id), req.claims!.sub, status) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/campaigns/me', limiters.read, auth, (req: AuthedRequest, res) => {
    res.json({ items: store.byAdvertiser(req.claims!.sub) });
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
