import { buildApp } from '@ather/service-kit';
import { buildStoriesRouter, StoryStore, getJwtSecret } from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: StoryStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new StoryStore();
  const app = buildApp({
    service: 'stories',
    env,
    routers: [['/stories', buildStoriesRouter(store, jwtSecret, env === 'test')]]
  });
  return { app, store };
}
