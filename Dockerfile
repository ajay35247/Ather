# syntax=docker/dockerfile:1.7
#
# Root Dockerfile for Railway / any container host.
#
# This builds and serves the @ather/api Express server from the monorepo. The
# deployment topology is:
#   • Vercel    → apps/web (Next.js)             — see apps/web/vercel.json
#   • Railway   → apps/api (this Dockerfile)     — see railway.json
#
# Per-app Dockerfiles still live under apps/*/Dockerfile and services/*/Dockerfile
# for direct service-by-service Kubernetes deployment; this root file is the
# entry point used when the API is deployed as a single project to Railway.

# ─── Builder ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /repo

# Copy workspace manifests + lockfile first for better layer caching.
# Pull in *every* workspace package.json so pnpm can resolve workspace:*
# references during install; the actual sources are copied after.
# .npmrc carries `force-legacy-deploy=true` which is required for
# `pnpm deploy --prod` under pnpm v10.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages ./packages

# Install only the api workspace closure.
RUN pnpm install --frozen-lockfile --filter @ather/api...

# Bring in the api source and build.
COPY apps/api ./apps/api
RUN pnpm --filter @ather/api build

# Prune dev deps from the install for a slim runtime image.
RUN pnpm --filter @ather/api --prod deploy /deploy

# ─── Runner ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

# `pnpm deploy --prod` produces a self-contained directory at /deploy with
# node_modules + package.json + dist (we copy dist next). Using `deploy`
# rather than copying the whole workspace avoids shipping every other
# service's source tree in the runtime image.
COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /deploy/package.json ./package.json
COPY --from=builder /repo/apps/api/dist ./dist

# Drop privileges. Using a fixed UID/GID lets host-volume mounts (if any) be
# predictable; node:alpine doesn't ship a non-root user by default.
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs api
USER api

EXPOSE 4000

# Container-level liveness — Railway will also hit /livez over HTTP, but this
# gives Docker Swarm / `docker run --health` a working signal too.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- "http://127.0.0.1:${PORT}/livez" || exit 1

CMD ["node", "dist/index.js"]

