import { config as loadEnv } from 'dotenv';
import { makeApp } from './app';

loadEnv();
const { app } = makeApp();
const port = Number(process.env.PORT ?? 4004);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[post] listening on :${port}`);
});
