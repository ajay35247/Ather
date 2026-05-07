import { buildApp } from '@ather/service-kit';
import { buildModerationRouter, ReviewQueue, getJwtSecret } from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  queue?: ReviewQueue;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const queue = deps.queue ?? new ReviewQueue();
  const router = buildModerationRouter(queue, jwtSecret, env === 'test');
  const app = buildApp({ service: 'moderation', env, routers: [['/moderation', router]] });
  return { app, queue };
}
