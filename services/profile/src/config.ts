import { z } from 'zod';

const Schema = z.object({
  PORT: z.coerce.number().int().min(0).default(4002),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_ACCESS_SECRET: z.string().min(16).default('dev-only-change-me-access-secret')
});

export type Config = z.infer<typeof Schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Schema.safeParse(env);
  if (!parsed.success) {
    throw new Error('Invalid configuration: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_ACCESS_SECRET.startsWith('dev-only')) {
    throw new Error('Refusing to start in production with default JWT secrets');
  }
  return parsed.data;
}
