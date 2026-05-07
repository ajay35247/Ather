// @ather/config — shared config helpers (scaffold)
export function getEnv(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export function getEnvNumber(name: string, fallback?: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Env var ${name} is not a number: ${raw}`);
  return n;
}
