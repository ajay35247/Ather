# syntax=docker/dockerfile:1.7
#
# Per-app Dockerfile for @ather/api.
#
# Build context MUST be the monorepo root, not apps/api, because the api
# depends on workspace packages (@ather/shared, @ather/i18n, ...) and the
# pnpm-lock.yaml at the root.
#
#   docker build -f apps/api/Dockerfile -t ather-api .
#
# The root Dockerfile in / does the same thing and is what Railway uses by
# default; this file lets you build just the API image without Railway.

FROM node:20-alpine AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages ./packages

RUN pnpm install --frozen-lockfile --filter @ather/api...

COPY apps/api ./apps/api
RUN pnpm --filter @ather/api build
RUN pnpm --filter @ather/api --prod deploy /deploy

FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /deploy/package.json ./package.json
COPY --from=builder /repo/apps/api/dist ./dist

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs api
USER api

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- "http://127.0.0.1:${PORT}/livez" || exit 1

CMD ["node", "dist/index.js"]

