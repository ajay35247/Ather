import { buildApp } from '@ather/service-kit';
import { buildRankingRouter, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const app = buildApp({
    service: 'ranking',
    env,
    routers: [['/ranking', buildRankingRouter(jwtSecret, env === 'test')]]
  });
  return { app };
}
