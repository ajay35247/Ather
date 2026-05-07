# gateway/

Edge + API gateway tier. All external traffic terminates here before being
routed to the appropriate microservice in [`../services/`](../services/).

## Proposed sub-tree

```
gateway/
├── api-gateway/          # central HTTP/WS/gRPC entrypoint
│   ├── rate-limiter/
│   ├── auth-check/       # JWT validation, propagated as `x-claims`
│   ├── websocket-routing/
│   ├── grpc-routing/
│   ├── graphql-federation/
│   ├── request-validation/
│   ├── throttling/
│   ├── caching/
│   └── api-versioning/
│
└── edge-gateway/         # CDN-edge functions
    ├── cloudflare-workers/
    ├── geo-routing/
    ├── image-optimization/
    └── edge-cache/
```

## Status

Today, the API gateway responsibilities live partially in `apps/api`
(monolith proxy) and per-service Express apps. This directory is reserved
for a dedicated gateway service when traffic warrants it (Phase 2+).

## See also

- [`packages/service-kit`](../packages/service-kit) — shared rate-limit, auth,
  and pagination middleware that today plays the role of the per-service
  gateway shim.
- [`infra/cloudflare`](../infra/cloudflare) — current edge configuration.
