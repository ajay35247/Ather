import { buildApp } from '@ather/service-kit';
import { buildMiniAppRouter, MiniAppRegistry, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  internalSecret?: string;
  registry?: MiniAppRegistry;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const internalSecret = deps.internalSecret ?? process.env.INTERNAL_SECRET ?? 'dev-internal';
  if (env === 'production' && internalSecret === 'dev-internal') {
    throw new Error('INTERNAL_SECRET must be set in production');
  }
  const registry = deps.registry ?? new MiniAppRegistry();
  const app = buildApp({
    service: 'mini-app-runtime',
    env,
    routers: [['/mini-apps', buildMiniAppRouter(registry, internalSecret, jwtSecret, env === 'test')]]
  });
  return { app, registry };
}
