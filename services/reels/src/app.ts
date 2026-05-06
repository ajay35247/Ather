import { buildApp } from '@ather/service-kit';
import { buildReelsRouter, ReelStore, getJwtSecret } from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: ReelStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new ReelStore();
  const app = buildApp({
    service: 'reels',
    env,
    routers: [['/reels', buildReelsRouter(store, jwtSecret, env === 'test')]]
  });
  return { app, store };
}
