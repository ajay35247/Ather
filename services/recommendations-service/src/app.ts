import { buildApp } from '@ather/service-kit';
import { buildRecommendationsRouter, Recommender, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  rec?: Recommender;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const rec = deps.rec ?? new Recommender();
  const app = buildApp({
    service: 'recommendations',
    env,
    routers: [['/recommendations', buildRecommendationsRouter(rec, jwtSecret, env === 'test')]]
  });
  return { app, rec };
}
