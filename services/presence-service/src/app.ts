import { buildApp } from '@ather/service-kit';
import { buildPresenceRouter, PresenceStore, getJwtSecret } from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: PresenceStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new PresenceStore();
  const router = buildPresenceRouter(store, jwtSecret, env === 'test');
  const app = buildApp({ service: 'presence', env, routers: [['/presence', router]] });
  return { app, store };
}
