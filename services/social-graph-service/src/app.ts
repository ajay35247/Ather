import { buildApp } from '@ather/service-kit';
import { buildSocialRouter, GraphStore, getJwtSecret } from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: GraphStore;
}

export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new GraphStore();
  const router = buildSocialRouter(store, jwtSecret, env === 'test');
  const app = buildApp({
    service: 'social-graph',
    env,
    routers: [['/social', router]]
  });
  return { app, store, env, jwtSecret };
}
