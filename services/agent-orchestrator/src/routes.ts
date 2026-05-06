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

export interface Plan {
  id: string;
  userId: string;
  goal: string;
  /** Tools the agent is permitted to call. Allowlist enforced. */
  allowedTools: string[];
  status: 'created' | 'running' | 'completed' | 'failed';
  steps: { tool: string; args: Record<string, unknown>; result?: unknown }[];
  createdAt: string;
}

const TOOL_ALLOWLIST = new Set([
  'search.web',
  'search.posts',
  'summarize.text',
  'translate.text'
]);

export class PlanStore {
  private plans: Plan[] = [];
  create(userId: string, goal: string, allowedTools: string[]): Plan {
    for (const t of allowedTools) {
      if (!TOOL_ALLOWLIST.has(t)) {
        throw new ForbiddenError(`tool not allowed: ${t}`);
      }
    }
    const p: Plan = {
      id: uuidv4(),
      userId,
      goal,
      allowedTools,
      status: 'created',
      steps: [],
      createdAt: new Date().toISOString()
    };
    this.plans.push(p);
    return p;
  }
  get(id: string, by: string): Plan {
    const p = this.plans.find((x) => x.id === id);
    if (!p) throw new NotFoundError('plan not found');
    if (p.userId !== by) throw new ForbiddenError('not owner');
    return p;
  }
  /** Phase 1 stub: pretend to "run" by appending a single completed step. */
  run(id: string, by: string): Plan {
    const p = this.get(id, by);
    p.status = 'completed';
    p.steps.push({
      tool: p.allowedTools[0] ?? 'noop',
      args: {},
      result: { stub: true, goal: p.goal }
    });
    return p;
  }
}

const CreateSchema = z.object({
  goal: z.string().min(1).max(500),
  allowedTools: z.array(z.string().min(1)).min(1).max(8)
});

export function buildOrchestratorRouter(store: PlanStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/plans', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const input = CreateSchema.parse(req.body);
      res
        .status(201)
        .json({ plan: store.create(req.claims!.sub, input.goal, input.allowedTools) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/plans/:id/run', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      res.json({ plan: store.run(String(req.params.id), req.claims!.sub) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/plans/:id', limiters.read, auth, (req: AuthedRequest, res, next) => {
    try {
      res.json({ plan: store.get(String(req.params.id), req.claims!.sub) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}

export { TOOL_ALLOWLIST };
