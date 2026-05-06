import { buildApp } from '@ather/service-kit';
import { buildGroupsRouter, GroupStore, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: GroupStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new GroupStore();
  const app = buildApp({
    service: 'groups',
    env,
    routers: [['/groups', buildGroupsRouter(store, jwtSecret, env === 'test')]]
  });
  return { app, store };
}
