import { buildApp } from '@ather/service-kit';
import { buildPostRouter, PostStore, getJwtSecret } from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: PostStore;
}

export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new PostStore();
  const router = buildPostRouter(store, jwtSecret, env === 'test');
  const app = buildApp({
    service: 'post',
    env,
    routers: [['/posts', router]]
  });
  return { app, store };
}
