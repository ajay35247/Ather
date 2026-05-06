import { buildApp } from '@ather/service-kit';
import { buildCommentsRouter, CommentStore, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: CommentStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new CommentStore();
  const app = buildApp({
    service: 'comments',
    env,
    routers: [['/comments', buildCommentsRouter(store, jwtSecret, env === 'test')]]
  });
  return { app, store };
}
