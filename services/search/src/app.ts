import { buildApp } from '@ather/service-kit';
import { buildSearchRouter, SearchIndex, getJwtSecret } from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  index?: SearchIndex;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const index = deps.index ?? new SearchIndex();
  const router = buildSearchRouter(index, jwtSecret, env === 'test');
  const app = buildApp({ service: 'search', env, routers: [['/search', router]] });
  return { app, index };
}
