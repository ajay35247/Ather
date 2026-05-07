import { buildApp } from '@ather/service-kit';
import { buildCreatorStudioRouter, CreatorStatsStore, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: CreatorStatsStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new CreatorStatsStore();
  const app = buildApp({
    service: 'creator-studio',
    env,
    routers: [['/creator-studio', buildCreatorStudioRouter(store, jwtSecret, env === 'test')]]
  });
  return { app, store };
}
