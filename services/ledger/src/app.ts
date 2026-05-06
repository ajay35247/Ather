import { buildApp } from '@ather/service-kit';
import { buildLedgerRouter, Ledger, getJwtSecret } from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  internalSecret?: string;
  ledger?: Ledger;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const internalSecret = deps.internalSecret ?? process.env.INTERNAL_SECRET ?? 'dev-internal';
  if (env === 'production' && internalSecret === 'dev-internal') {
    throw new Error('INTERNAL_SECRET must be set in production');
  }
  const ledger = deps.ledger ?? new Ledger();
  const app = buildApp({
    service: 'ledger',
    env,
    routers: [['/ledger', buildLedgerRouter(ledger, internalSecret, jwtSecret, env === 'test')]]
  });
  return { app, ledger, internalSecret };
}
