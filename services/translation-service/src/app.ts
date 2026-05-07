import { buildApp } from '@ather/service-kit';
import { buildTranslationRouter, StubTranslator, getJwtSecret, type Translator } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  translator?: Translator;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const translator = deps.translator ?? new StubTranslator();
  const app = buildApp({
    service: 'translation',
    env,
    routers: [['/translation', buildTranslationRouter(translator, jwtSecret, env === 'test')]]
  });
  return { app, translator };
}
