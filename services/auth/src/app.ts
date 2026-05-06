import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { loadConfig, type Config } from './config';
import { InMemoryUserStore, type UserStore } from './store';
import { buildAuthRouter } from './routes/auth';

export interface AppDeps {
  config?: Config;
  store?: UserStore;
}

export function buildApp(deps: AppDeps = {}) {
  const config = deps.config ?? loadConfig();
  const store = deps.store ?? new InMemoryUserStore();

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '64kb' }));
  if (config.NODE_ENV !== 'test') {
    app.use(pinoHttp({ redact: ['req.headers.authorization', 'req.body.password'] }));
  }

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth' }));
  app.use('/auth', buildAuthRouter(config, store));

  // Fallback error handler.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    // eslint-disable-next-line no-console
    console.error('unhandled error', err);
    res.status(500).json({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      code: 'internal_error'
    });
  });

  return { app, config, store };
}
