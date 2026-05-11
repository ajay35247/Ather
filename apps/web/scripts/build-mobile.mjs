// Wrapper for the Capacitor/Android static-export build.
//
// Next.js `output: 'export'` does not support dynamic Route Handlers (no POST
// handlers at all, and GET handlers may not read `request.headers` / cookies
// without `force-static`). The mobile Capacitor shell talks to the remote API
// at `NEXT_PUBLIC_API_URL` and never invokes the in-tree `src/app/api`
// handlers, so we exclude that directory from the export build entirely.
//
// We temporarily rename `src/app/api` to a sibling location outside of
// `src/app` for the duration of `next build`, then restore it in a `finally`
// block so a failed build never leaves the working tree in a half-state.

import { spawnSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = dirname(here);
const apiDir = join(webRoot, 'src', 'app', 'api');
// Stash the api dir under `src/` (not `src/app/`) so the Next.js app router
// never sees it during the export build.
const apiStash = join(webRoot, 'src', '.api-excluded-during-export');

function run(cmd, args, env) {
  const result = spawnSync(cmd, args, {
    cwd: webRoot,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

let stashed = false;
try {
  if (existsSync(apiDir)) {
    if (existsSync(apiStash)) {
      console.error(
        `[build-mobile] stash path already exists: ${apiStash}. Refusing to overwrite.`,
      );
      process.exit(1);
    }
    renameSync(apiDir, apiStash);
    stashed = true;
  }

  run('npx', ['--no-install', 'next', 'build'], { NEXT_OUTPUT: 'export' });
  run('npx', ['--no-install', 'cap', 'sync', 'android'], {});
} finally {
  if (stashed && existsSync(apiStash)) {
    renameSync(apiStash, apiDir);
  }
}
