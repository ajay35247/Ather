import { buildApp } from '@ather/service-kit';
import { buildMediaRouter, MediaStore, getJwtSecret } from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: MediaStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new MediaStore();
  const router = buildMediaRouter(store, jwtSecret, env === 'test');
  const app = buildApp({ service: 'media', env, routers: [['/media', router]] });
  return { app, store };
}
