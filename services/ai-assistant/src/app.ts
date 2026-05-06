import { buildApp } from '@ather/service-kit';
import {
  buildAssistantRouter,
  QuotaStore,
  StubProvider,
  getJwtSecret,
  type AiProvider,
  type AssistantConfig
} from './routes';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  config?: Partial<AssistantConfig>;
  provider?: AiProvider;
  quotas?: QuotaStore;
}

export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const config: AssistantConfig = {
    dailyQuota: deps.config?.dailyQuota ?? Number(process.env.AI_DAILY_QUOTA ?? 100)
  };
  const provider = deps.provider ?? new StubProvider();
  const quotas = deps.quotas ?? new QuotaStore();
  const router = buildAssistantRouter(config, provider, quotas, jwtSecret, env === 'test');
  const app = buildApp({ service: 'ai-assistant', env, routers: [['/ai', router]] });
  return { app, quotas, provider, config };
}
