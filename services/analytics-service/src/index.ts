import { config as loadEnv } from 'dotenv';
import { makeApp } from './app';
loadEnv();
const { app } = makeApp();
const port = Number(process.env.PORT ?? 4038);
app.listen(port, () => console.log(`[analytics] listening on :${port}`));
