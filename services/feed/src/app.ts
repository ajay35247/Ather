import { buildApp } from '@ather/service-kit';
import { buildFeedRouter, FeedStore, getJwtSecret } from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: FeedStore;
}

export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new FeedStore();
  const router = buildFeedRouter(store, jwtSecret, env === 'test');
  const app = buildApp({ service: 'feed', env, routers: [['/feed', router]] });
  return { app, store };
}
