import { buildApp } from '@ather/service-kit';
import { buildSubscriptionsRouter, SubscriptionStore, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: SubscriptionStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new SubscriptionStore();
  const app = buildApp({
    service: 'subscriptions',
    env,
    routers: [['/subscriptions', buildSubscriptionsRouter(store, jwtSecret, env === 'test')]]
  });
  return { app, store };
}
