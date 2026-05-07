import { Router } from 'express';
import {
  defaultLimiters,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest
} from '@ather/service-kit';

export interface CreatorStats {
  postsTotal: number;
  followers: number;
  engagementRate: number;
  monetizableViewsLast30d: number;
  estimatedEarningsMinor: number;
  currency: 'INR' | 'USD' | 'EUR';
}

/** Phase 1 stub. Production aggregates analytics → creator-studio CDC. */
export class CreatorStatsStore {
  private map = new Map<string, CreatorStats>();
  set(userId: string, stats: CreatorStats): void {
    this.map.set(userId, stats);
  }
  get(userId: string): CreatorStats {
    return (
      this.map.get(userId) ?? {
        postsTotal: 0,
        followers: 0,
        engagementRate: 0,
        monetizableViewsLast30d: 0,
        estimatedEarningsMinor: 0,
        currency: 'INR'
      }
    );
  }
}

export function buildCreatorStudioRouter(
  store: CreatorStatsStore,
  jwtSecret: string,
  isTest: boolean
) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.get('/me', limiters.read, auth, (req: AuthedRequest, res) => {
    res.json({ stats: store.get(req.claims!.sub) });
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
