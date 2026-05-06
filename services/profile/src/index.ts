import { config as loadEnv } from 'dotenv';
import { buildApp } from './app';

loadEnv();

const { app, config } = buildApp();

const server = app.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[profile] listening on :${config.PORT} (${config.NODE_ENV})`);
});

const shutdown = (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`[profile] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
