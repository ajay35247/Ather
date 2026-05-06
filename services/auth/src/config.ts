import { z } from 'zod';

const Schema = z.object({
  PORT: z.coerce.number().int().min(0).default(4001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_ACCESS_SECRET: z.string().min(16).default('dev-only-change-me-access-secret'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-only-change-me-refresh-secret'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30)
});

export type Config = z.infer<typeof Schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Schema.safeParse(env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid configuration');
  }
  if (parsed.data.NODE_ENV === 'production') {
    if (
      parsed.data.JWT_ACCESS_SECRET.startsWith('dev-only') ||
      parsed.data.JWT_REFRESH_SECRET.startsWith('dev-only')
    ) {
      throw new Error('Refusing to start in production with default JWT secrets');
    }
  }
  return parsed.data;
}
