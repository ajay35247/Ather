import { buildApp } from '@ather/service-kit';
import { buildNotificationRouter, NotificationStore, getJwtSecret } from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  internalSecret?: string;
  store?: NotificationStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const internalSecret = deps.internalSecret ?? process.env.INTERNAL_SECRET ?? 'dev-internal';
  if (env === 'production' && internalSecret === 'dev-internal') {
    throw new Error('INTERNAL_SECRET must be set in production');
  }
  const store = deps.store ?? new NotificationStore();
  const router = buildNotificationRouter(store, jwtSecret, env === 'test', internalSecret);
  const app = buildApp({ service: 'notification', env, routers: [['/notifications', router]] });
  return { app, store, internalSecret };
}
