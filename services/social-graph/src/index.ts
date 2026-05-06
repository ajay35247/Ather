import { config as loadEnv } from 'dotenv';
import { makeApp } from './app';

loadEnv();
const { app } = makeApp();
const port = Number(process.env.PORT ?? 4003);
const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[social-graph] listening on :${port}`);
});
const shutdown = (s: string) => {
  // eslint-disable-next-line no-console
  console.log(`[social-graph] ${s}`);
  server.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
