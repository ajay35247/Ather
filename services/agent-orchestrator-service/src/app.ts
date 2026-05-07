import { buildApp } from '@ather/service-kit';
import { buildOrchestratorRouter, PlanStore, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: PlanStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new PlanStore();
  const app = buildApp({
    service: 'agent-orchestrator',
    env,
    routers: [['/agent', buildOrchestratorRouter(store, jwtSecret, env === 'test')]]
  });
  return { app, store };
}
