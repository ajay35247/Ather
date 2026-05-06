# Ather service inventory

This document is the canonical map of every service in the Ather monorepo.
Each row corresponds to a workspace under `services/*`. Phase numbers track
the [roadmap](./roadmap.md).

| Phase | Service | Path | Default port | Status | Surface |
|-------|---------|------|---------------|--------|---------|
| 0 | auth                | `services/auth`                | 4001 | Built | `/auth/*` (signup, login, refresh, logout, /me) |
| 0 | profile             | `services/profile`             | 4002 | Built | `/profile/*` (me, update, by-handle) |
| 1 | social-graph        | `services/social-graph`        | 4003 | Built | `/social/*` (follow/unfollow, block, followers, following) |
| 1 | post                | `services/post`                | 4004 | Built | `/posts/*` (create, get, by-author, delete, react) |
| 1 | feed                | `services/feed`                | 4005 | Built | `/feed/*` (home: for_you/following/chronological, /report) |
| 1 | media               | `services/media`               | 4006 | Built | `/media/*` (upload-url, finalize, by-id) |
| 1 | chat                | `services/chat`                | 4007 | Built | `/chat/*` (conversations, messages — ciphertext only) |
| 1 | presence            | `services/presence`            | 4008 | Built | `/presence/*` (heartbeat, get, bulk) |
| 1 | notification        | `services/notification`        | 4009 | Built | `/notifications/*` (list, unread-count, mark-read, internal push) |
| 1 | search              | `services/search`              | 4010 | Built | `/search` (substring index over users + posts) |
| 1 | moderation          | `services/moderation`          | 4011 | Built | `/moderation/*` (classify, report, queue) |
| 1 | ai-assistant        | `services/ai-assistant`        | 4012 | Built | `/ai/*` (chat SSE, summarize, suggest-reply, generate-caption, quota) |
| 2 | reels               | `services/reels`               | 4020 | Built | `/reels/*` (CRUD, list) |
| 2 | stories             | `services/stories`             | 4021 | Built | `/stories/*` (create, active, by-author) |
| 2 | comments            | `services/comments`            | 4022 | Built | `/comments/*` (create, by-post, delete) |
| 2 | communities         | `services/communities`         | 4023 | Built | `/communities/*` (create, by-slug, join, members, role) |
| 2 | groups              | `services/groups`              | 4024 | Built | `/groups/*` (create, get, add member) |
| 2 | ranking             | `services/ranking`             | 4025 | Built | `/ranking/score` (linear reranker stub) |
| 2 | recommendations     | `services/recommendations`     | 4026 | Built | `/recommendations/for-me` (cosine-based two-tower stub) |
| 2 | content-events      | `services/content-events`      | 4027 | Built | `/events/*` (publish, topic consume — Kafka shim) |
| 3 | wallet              | `services/wallet`              | 4030 | Built | `/wallet/me`, `/wallet/internal/set` |
| 3 | payments            | `services/payments`            | 4031 | Built | `/payments/intents`, `/payments/webhooks/confirm` |
| 3 | subscriptions       | `services/subscriptions`       | 4032 | Built | `/subscriptions/*` (subscribe, cancel, me) |
| 3 | tips                | `services/tips`                | 4033 | Built | `/tips/*` (send, received) |
| 3 | ads                 | `services/ads`                 | 4034 | Built | `/ads/campaigns/*` (create, status change, me) |
| 3 | creator-studio      | `services/creator-studio`      | 4035 | Built | `/creator-studio/me` |
| 3 | live-stream         | `services/live-stream`         | 4036 | Built | `/live/*` (start, end, active) |
| 3 | audio-rooms         | `services/audio-rooms`         | 4037 | Built | `/audio-rooms/*` (create, join, close, open) |
| 3 | analytics           | `services/analytics`           | 4038 | Built | `/analytics/*` (track, count) |
| 3 | ledger              | `services/ledger`              | 4039 | Built | `/ledger/*` (accounts, entries, balance, health-check) — **enforces double-entry invariant** |
| 4 | mini-app-runtime    | `services/mini-app-runtime`    | 4050 | Built | `/mini-apps/*` (register, approve, approved) — **capability allowlist enforced** |
| 4 | plugin-marketplace  | `services/plugin-marketplace`  | 4051 | Built | `/marketplace/*` (list, install, search) |
| 4 | bot-platform        | `services/bot-platform`        | 4052 | Built | `/bots/*` (register, by-handle) — **https-only webhooks** |
| 4 | knowledge-graph     | `services/knowledge-graph`     | 4053 | Built | `/kg/*` (entities, edges, neighbors) |
| 4 | vector-search       | `services/vector-search`       | 4054 | Built | `/vectors/*` (upsert, query) |
| 4 | agent-orchestrator  | `services/agent-orchestrator`  | 4055 | Built | `/agent/plans/*` — **tool allowlist enforced** |
| 4 | translation         | `services/translation`         | 4056 | Built | `/translation/translate` |
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
