# infra/docker/

Environment-specific Docker Compose / image overrides.

- `development/` — local dev overrides
- `staging/` — staging compose / image variants
- `production/` — production-only build args & overlays

The canonical local stack remains [`infra/docker-compose.yml`](../docker-compose.yml).
