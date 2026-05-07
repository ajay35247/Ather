import { buildApp } from '@ather/service-kit';
import { buildEventsRouter, EventLog, getJwtSecret } from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  internalSecret?: string;
  log?: EventLog;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const internalSecret = deps.internalSecret ?? process.env.INTERNAL_SECRET ?? 'dev-internal';
  if (env === 'production' && internalSecret === 'dev-internal') {
    throw new Error('INTERNAL_SECRET must be set in production');
  }
  const log = deps.log ?? new EventLog();
  const app = buildApp({
    service: 'content-events',
    env,
    routers: [['/events', buildEventsRouter(log, internalSecret, jwtSecret, env === 'test')]]
  });
  return { app, log, internalSecret };
}
