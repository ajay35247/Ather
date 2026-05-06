# syntax=docker/dockerfile:1.7

# ----- builder ------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /repo

# Copy only what's needed to install workspace deps. Paths are relative
# to the repo root because we build from there (see deploy workflow).
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY services/feed ./services/feed

# Install all workspaces (small) — `--ignore-scripts` is safer in CI.
RUN npm ci --ignore-scripts --no-audit --no-fund

# Build feed service + its workspace deps.
RUN npm --workspace @ather/feed-service run build

# ----- runtime -----------------------------------------------------
FROM node:20-alpine AS runtime
RUN addgroup -S ather && adduser -S ather -G ather
WORKDIR /app

# Copy compiled output and trimmed node_modules.
COPY --from=builder /repo/services/feed/dist ./dist
COPY --from=builder /repo/services/feed/package.json ./package.json
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages

ENV NODE_ENV=production
ENV PORT=4005
EXPOSE 4005
USER ather

# Healthcheck hits the /health endpoint exposed by service-kit.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4005/health || exit 1

CMD ["node", "dist/index.js"]
