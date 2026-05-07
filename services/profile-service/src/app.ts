import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { loadConfig, type Config } from './config';
import { InMemoryProfileStore, type ProfileStore } from './store';
import { buildProfileRouter } from './routes/profile';

export interface AppDeps {
  config?: Config;
  store?: ProfileStore;
}

export function buildApp(deps: AppDeps = {}) {
  const config = deps.config ?? loadConfig();
  const store = deps.store ?? new InMemoryProfileStore();

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '64kb' }));
  if (config.NODE_ENV !== 'test') {
    app.use(pinoHttp({ redact: ['req.headers.authorization'] }));
  }

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'profile' }));
  app.use('/profile', buildProfileRouter(config, store));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    // eslint-disable-next-line no-console
    console.error('unhandled error', err);
    res.status(500).json({ status: 500, code: 'internal_error' });
  });

  return { app, config, store };
}
