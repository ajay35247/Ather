import { buildApp } from '@ather/service-kit';
import { buildCommunitiesRouter, CommunityStore, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: CommunityStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new CommunityStore();
  const app = buildApp({
    service: 'communities',
    env,
    routers: [['/communities', buildCommunitiesRouter(store, jwtSecret, env === 'test')]]
  });
  return { app, store };
}
