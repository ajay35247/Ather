import { buildApp } from '@ather/service-kit';
import { buildLiveRouter, LiveStore, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: LiveStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new LiveStore();
  const app = buildApp({
    service: 'live-stream',
    env,
    routers: [['/live', buildLiveRouter(store, jwtSecret, env === 'test')]]
  });
  return { app, store };
}
