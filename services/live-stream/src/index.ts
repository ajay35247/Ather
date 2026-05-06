import { config as loadEnv } from 'dotenv';
import { makeApp } from './app';
loadEnv();
const { app } = makeApp();
const port = Number(process.env.PORT ?? 4036);
app.listen(port, () => console.log(`[live-stream] listening on :${port}`));
