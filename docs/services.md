# Ather service inventory

This document is the canonical map of every service in the Ather monorepo.
Each row corresponds to a workspace under `services/*`. Phase numbers track
the [roadmap](./roadmap.md).

| Phase | Service | Path | Default port | Status | Surface |
|-------|---------|------|---------------|--------|---------|
| 0 | auth                | `services/auth-service`                | 4001 | Built | `/auth/*` (signup, login, refresh, logout, /me) |
| 0 | profile             | `services/profile-service`             | 4002 | Built | `/profile/*` (me, update, by-handle) |
| 1 | social-graph        | `services/social-graph-service`        | 4003 | Built | `/social/*` (follow/unfollow, block, followers, following) |
| 1 | post                | `services/post-service`                | 4004 | Built | `/posts/*` (create, get, by-author, delete, react) |
| 1 | feed                | `services/feed-service`                | 4005 | Built | `/feed/*` (home: for_you/following/chronological, /report) |
| 1 | media               | `services/media-service`               | 4006 | Built | `/media/*` (upload-url, finalize, by-id) |
| 1 | chat                | `services/chat-service`                | 4007 | Built | `/chat/*` (conversations, messages — ciphertext only) |
| 1 | presence            | `services/presence-service`            | 4008 | Built | `/presence/*` (heartbeat, get, bulk) |
| 1 | notification        | `services/notification-service`        | 4009 | Built | `/notifications/*` (list, unread-count, mark-read, internal push) |
| 1 | search              | `services/search-service`              | 4010 | Built | `/search` (substring index over users + posts) |
| 1 | moderation          | `services/moderation-service`          | 4011 | Built | `/moderation/*` (classify, report, queue) |
| 1 | ai-assistant        | `services/ai-assistant-service`        | 4012 | Built | `/ai/*` (chat SSE, summarize, suggest-reply, generate-caption, quota) |
| 2 | reels               | `services/post-service`               | 4020 | Built | `/reels/*` (CRUD, list) |
| 2 | stories             | `services/post-service`             | 4021 | Built | `/stories/*` (create, active, by-author) |
| 2 | comments            | `services/post-service`            | 4022 | Built | `/comments/*` (create, by-post, delete) |
| 2 | communities         | `services/communities-service`         | 4023 | Built | `/communities/*` (create, by-slug, join, members, role) |
| 2 | groups              | `services/groups-service`              | 4024 | Built | `/groups/*` (create, get, add member) |
| 2 | ranking             | `services/ranking-service`             | 4025 | Built | `/ranking/score` (linear reranker stub) |
| 2 | recommendations     | `services/recommendations-service`     | 4026 | Built | `/recommendations/for-me` (cosine-based two-tower stub) |
| 2 | content-events      | `services/content-events-service`      | 4027 | Built | `/events/*` (publish, topic consume — Kafka shim) |
| 3 | wallet              | `services/wallet-service`              | 4030 | Built | `/wallet/me`, `/wallet/internal/set` |
| 3 | payments            | `services/payments-service`            | 4031 | Built | `/payments/intents`, `/payments/webhooks/confirm` |
| 3 | subscriptions       | `services/subscriptions-service`       | 4032 | Built | `/subscriptions/*` (subscribe, cancel, me) |
| 3 | tips                | `services/tips-service`                | 4033 | Built | `/tips/*` (send, received) |
| 3 | ads                 | `services/ads-service`                 | 4034 | Built | `/ads/campaigns/*` (create, status change, me) |
| 3 | creator-studio      | `services/creator-studio-service`      | 4035 | Built | `/creator-studio/me` |
| 3 | live-stream         | `services/live-stream-service`         | 4036 | Built | `/live/*` (start, end, active) |
| 3 | audio-rooms         | `services/audio-rooms-service`         | 4037 | Built | `/audio-rooms/*` (create, join, close, open) |
| 3 | analytics           | `services/analytics-service`           | 4038 | Built | `/analytics/*` (track, count) |
| 3 | ledger              | `services/ledger-service`              | 4039 | Built | `/ledger/*` (accounts, entries, balance, health-check) — **enforces double-entry invariant** |
| 4 | mini-app-runtime    | `services/mini-app-runtime-service`    | 4050 | Built | `/mini-apps/*` (register, approve, approved) — **capability allowlist enforced** |
| 4 | plugin-marketplace  | `services/plugin-marketplace-service`  | 4051 | Built | `/marketplace/*` (list, install, search) |
| 4 | bot-platform        | `services/bot-platform-service`        | 4052 | Built | `/bots/*` (register, by-handle) — **https-only webhooks** |
| 4 | knowledge-graph     | `services/knowledge-graph-service`     | 4053 | Built | `/kg/*` (entities, edges, neighbors) |
| 4 | vector-search       | `services/vector-search-service`       | 4054 | Built | `/vectors/*` (upsert, query) |
| 4 | agent-orchestrator  | `services/agent-orchestrator-service`  | 4055 | Built | `/agent/plans/*` — **tool allowlist enforced** |
| 4 | translation         | `services/translation-service`         | 4056 | Built | `/translation/translate` |
| 5 | web3-identity       | (deferred) | — | **Not built** | See [Phase 5 deferral](./phase5-deferral.md) |
| 5 | ar-location         | (deferred) | — | **Not built** | See [Phase 5 deferral](./phase5-deferral.md) |
| 5 | advanced-agents     | (deferred) | — | **Not built** | See [Phase 5 deferral](./phase5-deferral.md) |
| 5 | digital-legacy      | (deferred) | — | **Not built** | See [Phase 5 deferral](./phase5-deferral.md) |

## Conventions

Every service follows the same shape, enforced by `packages/service-kit`:

* `src/routes.ts` — pure routing + in-memory store (swap for DB in production).
* `src/app.ts` — wires the router, JWT secret, internal-secret, and rate limits into a `buildApp`.
* `src/index.ts` — entry point: loads `.env`, listens on `process.env.PORT`.
* `test/<service>.test.ts` — supertest against `makeApp({ env: 'test', ... })`.

All services expose `/health` returning `{ service, ok: true }` and serve a
JSON 404 envelope `{ status, code, detail }` on unknown routes. Rate limits
are bypassed when `NODE_ENV === 'test'`.

## Inter-service writes

Services that must accept writes from other services (`notification`,
`content-events`, `ledger`, `wallet`, `payments`, `mini-app-runtime`,
`plugin-marketplace`, `bot-platform`) require an `x-internal-secret` header
(`INTERNAL_SECRET` env var) and reject `dev-internal` in production.
