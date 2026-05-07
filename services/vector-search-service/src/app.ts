import { buildApp } from '@ather/service-kit';
import { buildVectorRouter, VectorIndex, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  index?: VectorIndex;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const index = deps.index ?? new VectorIndex();
  const app = buildApp({
    service: 'vector-search',
    env,
    routers: [['/vectors', buildVectorRouter(index, jwtSecret, env === 'test')]]
  });
  return { app, index };
}
