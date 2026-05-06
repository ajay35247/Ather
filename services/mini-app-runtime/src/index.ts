import { config as loadEnv } from 'dotenv';
import { makeApp } from './app';
loadEnv();
const { app } = makeApp();
const port = Number(process.env.PORT ?? 4050);
app.listen(port, () => console.log(`[mini-app-runtime] listening on :${port}`));
