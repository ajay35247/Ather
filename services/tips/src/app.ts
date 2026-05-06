import { buildApp } from '@ather/service-kit';
import { buildTipsRouter, TipStore, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: TipStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new TipStore();
  const app = buildApp({
    service: 'tips',
    env,
    routers: [['/tips', buildTipsRouter(store, jwtSecret, env === 'test')]]
  });
  return { app, store };
}
