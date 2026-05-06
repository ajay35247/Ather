import express, { type Express, type RequestHandler, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { errorHandler } from './errors';

export interface BuildAppOptions {
  /** Service name, used in /health and logs. */
  service: string;
  /** Routers to mount. Each tuple: [pathPrefix, router]. */
  routers?: Array<[string, RequestHandler]>;
  /** When 'test', disables HTTP logger to keep test output clean. */
  env?: 'development' | 'test' | 'production';
  /** Custom JSON body limit. Default 64kb. */
  jsonLimit?: string;
}

export function buildApp(opts: BuildAppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: opts.jsonLimit ?? '64kb' }));
  if (opts.env !== 'test') {
    app.use(
      pinoHttp({
        redact: ['req.headers.authorization', 'req.body.password', 'req.body.token']
      })
    );
  }

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: opts.service });
  });

  for (const [path, router] of opts.routers ?? []) {
    app.use(path, router);
  }

  // Final error handler (after all routes).
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) =>
    errorHandler(err, req, res, next)
  );

  return app;
}
