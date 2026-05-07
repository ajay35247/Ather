# Contributing to Ather

Thanks for your interest in contributing!

## Development setup

```bash
npm install        # install all workspaces
npm run dev        # run web (3000) + api (4000) concurrently
npm run typecheck  # typecheck every workspace
npm run test       # run all workspace tests
```

This is a monorepo using **npm workspaces**. Apps live in `apps/`, backend
services in `services/`, and shared libraries in `packages/`.

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
