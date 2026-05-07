import { buildApp } from '@ather/service-kit';
import { buildAnalyticsRouter, EventSink, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  sink?: EventSink;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const sink = deps.sink ?? new EventSink();
  const app = buildApp({
    service: 'analytics',
    env,
    routers: [['/analytics', buildAnalyticsRouter(sink, jwtSecret, env === 'test')]]
  });
  return { app, sink };
}
