import { buildApp } from '@ather/service-kit';
import { buildPaymentsRouter, PaymentStore, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  internalSecret?: string;
  store?: PaymentStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const internalSecret = deps.internalSecret ?? process.env.INTERNAL_SECRET ?? 'dev-internal';
  if (env === 'production' && internalSecret === 'dev-internal') {
    throw new Error('INTERNAL_SECRET must be set in production');
  }
  const store = deps.store ?? new PaymentStore();
  const app = buildApp({
    service: 'payments',
    env,
    routers: [['/payments', buildPaymentsRouter(store, internalSecret, jwtSecret, env === 'test')]]
  });
  return { app, store };
}
