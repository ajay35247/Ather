# syntax=docker/dockerfile:1.7

# ----- builder ------------------------------------------------------
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo

# Copy workspace metadata and the targeted service + its package deps.
# Paths are relative to the repo root because we build from there.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY services/feed-service ./services/feed-service

# Install workspace deps (lockfile-frozen) for the feed-service slice only.
RUN pnpm install --frozen-lockfile --filter @ather/feed-service...

# Build feed-service + its workspace deps.
RUN pnpm --filter @ather/feed-service run build

# Trim dev-only deps from the production node_modules.
RUN pnpm --filter @ather/feed-service deploy --prod /opt/feed-service-prod

# ----- runtime -----------------------------------------------------
FROM node:20-alpine AS runtime
RUN addgroup -S ather && adduser -S ather -G ather
WORKDIR /app

# Copy the self-contained, prod-only deploy bundle from pnpm deploy.
COPY --from=builder /opt/feed-service-prod ./

ENV NODE_ENV=production
ENV PORT=4005
EXPOSE 4005
USER ather

# Healthcheck hits the /health endpoint exposed by service-kit.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4005/health || exit 1

CMD ["node", "dist/index.js"]
