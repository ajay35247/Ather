# event-streaming/

Async event backbone connecting all `services/*-service` workspaces.

## Proposed sub-tree

```
event-streaming/
├── kafka/
│   ├── topics/
│   │   ├── user-events/
│   │   ├── feed-events/
│   │   ├── ai-events/
│   │   ├── payment-events/
│   │   └── moderation-events/
│   ├── consumers/
│   └── producers/
│
└── event-bus/            # in-process bus for monolith mode
```

## Status

Phase 0–1 services use synchronous HTTP + in-memory adapters. The event-bus
abstraction lives in `packages/service-kit` and will be backed by a real
Kafka/Redpanda cluster when we cross the Phase 2 traffic threshold.

## See also

- [`infra/docker-compose.yml`](../infra/docker-compose.yml) — local Postgres + Redis.
- [`docs/feed-pillar.md`](../docs/feed-pillar.md) — current dual-write contract for fanout.
