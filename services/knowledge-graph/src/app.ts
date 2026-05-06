import { buildApp } from '@ather/service-kit';
import { buildKnowledgeGraphRouter, KnowledgeGraph, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  graph?: KnowledgeGraph;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const graph = deps.graph ?? new KnowledgeGraph();
  const app = buildApp({
    service: 'knowledge-graph',
    env,
    routers: [['/kg', buildKnowledgeGraphRouter(graph, jwtSecret, env === 'test')]]
  });
  return { app, graph };
}
