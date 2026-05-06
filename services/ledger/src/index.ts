import { config as loadEnv } from 'dotenv';
import { makeApp } from './app';
loadEnv();
const { app } = makeApp();
const port = Number(process.env.PORT ?? 4039);
app.listen(port, () => console.log(`[ledger] listening on :${port}`));
