import { buildApp } from '@ather/service-kit';
import { buildChatRouter, ChatStore, getJwtSecret } from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: ChatStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new ChatStore();
  const router = buildChatRouter(store, jwtSecret, env === 'test');
  const app = buildApp({ service: 'chat', env, routers: [['/chat', router]] });
  return { app, store };
}
