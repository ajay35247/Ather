import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  requireJwtSecret,
  ForbiddenError,
  NotFoundError
} from '@ather/service-kit';

/**
 * Mini-app runtime registers third-party apps that run inside the Ather shell.
 * Phase 4 stub: registry + capability allowlist. Production sandboxes apps via
 * a worker (e.g. CF Workers) and enforces the capability set at the gateway.
 */
export type Capability =
  | 'read:public-profile'
  | 'read:my-posts'
  | 'write:my-posts'
  | 'read:my-wallet'
  | 'send:notification';

const ALLOWED_CAPS: Capability[] = [
  'read:public-profile',
  'read:my-posts',
  'write:my-posts',
  'read:my-wallet',
  'send:notification'
];

export interface MiniApp {
  id: string;
  slug: string;
  name: string;
  vendorId: string;
  capabilities: Capability[];
  status: 'pending_review' | 'approved' | 'suspended';
  createdAt: string;
}

export class MiniAppRegistry {
  private apps: MiniApp[] = [];
  register(input: { slug: string; name: string; vendorId: string; capabilities: Capability[] }): MiniApp {
    const bad = input.capabilities.find((c) => !ALLOWED_CAPS.includes(c));
    if (bad) throw new ForbiddenError(`capability not allowed: ${bad}`);
    if (this.apps.find((a) => a.slug === input.slug)) {
      throw new ForbiddenError('slug already registered');
    }
    const a: MiniApp = {
      id: uuidv4(),
      ...input,
      status: 'pending_review',
      createdAt: new Date().toISOString()
    };
    this.apps.push(a);
    return a;
  }
  approve(id: string): MiniApp {
    const a = this.apps.find((x) => x.id === id);
    if (!a) throw new NotFoundError('app not found');
    a.status = 'approved';
    return a;
  }
  bySlug(slug: string): MiniApp | null {
    return this.apps.find((a) => a.slug === slug) ?? null;
  }
  approved(): MiniApp[] {
    return this.apps.filter((a) => a.status === 'approved');
  }
}

const RegisterSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_-]{3,32}$/),
  name: z.string().min(1).max(80),
  vendorId: z.string().min(1),
  capabilities: z.array(z.string()).max(10)
});

export function buildMiniAppRouter(
  registry: MiniAppRegistry,
  internalSecret: string,
  _jwtSecret: string,
  isTest: boolean
) {
  const limiters = defaultLimiters(isTest);
  const router = Router();

  router.post('/register', limiters.write, (req, res, next) => {
    if (req.header('x-internal-secret') !== internalSecret) {
      res.status(401).json({ status: 401, code: 'unauthorized' });
      return;
    }
    try {
      const input = RegisterSchema.parse(req.body);
      const app = registry.register({
        ...input,
        capabilities: input.capabilities as Capability[]
      });
      res.status(201).json({ app });
    } catch (err) {
      next(err);
    }
  });

  router.post('/approve/:id', limiters.write, (req, res, next) => {
    if (req.header('x-internal-secret') !== internalSecret) {
      res.status(401).json({ status: 401, code: 'unauthorized' });
      return;
    }
    try {
      res.json({ app: registry.approve(String(req.params.id)) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/approved', limiters.read, (_req, res) => {
    res.json({ items: registry.approved() });
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}

export { ALLOWED_CAPS };
