import { buildApp } from '@ather/service-kit';
import { buildAdsRouter, CampaignStore, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: CampaignStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new CampaignStore();
  const app = buildApp({
    service: 'ads',
    env,
    routers: [['/ads', buildAdsRouter(store, jwtSecret, env === 'test')]]
  });
  return { app, store };
}
