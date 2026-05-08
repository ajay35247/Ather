# syntax=docker/dockerfile:1.7
#
# Single-project Dockerfile for Railway / any container host.
# Builds and serves the @ather/web Next.js app from the monorepo root.
#
# Per-app Dockerfiles still live under apps/*/Dockerfile and services/*/Dockerfile
# for direct service-by-service deployment to Kubernetes; this root file is the
# entry point used when the repo is deployed as a single project.

# ─── Builder ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /repo

# Copy workspace manifest + lockfile first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages ./packages

# Install only what the web app's workspace closure needs.
RUN pnpm install --frozen-lockfile --filter @ather/web...

# Bring in the rest of the web app source and build.
COPY apps/web ./apps/web
RUN pnpm --filter @ather/web build

# ─── Runner ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /repo

# Copy the built workspace as-is. pnpm next start needs the workspace layout
# preserved so symlinked workspace deps (@ather/shared, @ather/i18n, @ather/india)
# resolve at runtime.
COPY --from=builder /repo /repo

# Drop privileges.
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
USER nextjs

# Railway/Heroku-style: PORT is injected by the host. Default to 3000 for local.
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "--filter", "@ather/web", "start"]
