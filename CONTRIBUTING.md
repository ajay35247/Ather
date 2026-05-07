# Contributing to Ather

Thanks for your interest in contributing!

## Development setup

This monorepo uses **pnpm workspaces** and **Turborepo**.

```bash
corepack enable                       # one-time, picks pnpm version from package.json
pnpm install                          # install all workspaces
pnpm dev                              # run web (3000) + api (4000) concurrently
pnpm turbo run typecheck              # typecheck every workspace (cached)
pnpm turbo run build                  # build every workspace (cached)
pnpm turbo run test                   # run all workspace tests (cached)
pnpm --filter @ather/post-service run dev   # work on a single service
```

`pnpm-workspace.yaml` enumerates workspace globs; `turbo.json` defines the task graph; `.npmrc` keeps hoisting compatible with the previous npm-workspaces layout.

## Branching & PRs

- Create a topic branch from the default branch.
- Keep PRs focused; one logical change per PR.
- Run `npm run typecheck` and the relevant test suites locally before opening a PR.
- Write a clear PR title and description (the template will guide you).

## Code conventions

- TypeScript strict mode (see `tsconfig.base.json`).
- Use `@ather/shared` types instead of redefining shared shapes.
- New shared utilities go under `packages/` (e.g. `@ather/logger`,
  `@ather/validation`, `@ather/config`).
- Never commit secrets. Use `.env.example` as the source of required env vars.

## Security

- Validate all URLs to `http`/`https` only.
- Use `Object.create(null)` for in-memory key-value stores to avoid prototype
  pollution.
- Backend rate-limit middleware must be active in non-test environments.

See [`docs/security.md`](docs/security.md) for more.
