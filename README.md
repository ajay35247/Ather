# Ather

> **Omni-Social Operating System** — a unified identity, social, communication, and creator
> platform. This repo carries the **complete Phase 0–4 monorepo scaffold** for the
> [`docs/roadmap.md`](./docs/roadmap.md) blueprint. Phase 5 is intentionally deferred per
> [`docs/phase5-deferral.md`](./docs/phase5-deferral.md).

The full design blueprint (architecture, API, schema, security, scaling, monetization, roadmap)
lives in [`/docs`](./docs). The full per-service inventory is in [`docs/services.md`](./docs/services.md).

---

## What's in this repo

```
ather/
├── apps/
│   └── web/                 # Next.js 15 App Router — feed, auth, profile shell
├── packages/
│   ├── shared/              # Shared TS types & API contracts
│   └── service-kit/         # Shared Express factory: app, auth, rate-limits, errors, pagination
├── services/                # 35 backend services (Express + TS) — see docs/services.md
│   ├── auth, profile                                                       # Phase 0
│   ├── social-graph, post, feed, media, chat, presence,
│   │   notification, search, moderation, ai-assistant                      # Phase 1
│   ├── reels, stories, comments, communities, groups,
│   │   ranking, recommendations, content-events                            # Phase 2
│   ├── wallet, payments, subscriptions, tips, ads, creator-studio,
│   │   live-stream, audio-rooms, analytics, ledger                         # Phase 3
│   └── mini-app-runtime, plugin-marketplace, bot-platform,
│       knowledge-graph, vector-search, agent-orchestrator, translation     # Phase 4
├── infra/
│   ├── docker-compose.yml   # Local Postgres + Redis
│   └── postgres/init.sql    # Per-service Postgres schemas
├── docs/                    # Architecture, API, DB, security, scaling, monetization, roadmap, services
└── .github/workflows/ci.yml # Typecheck · build · test
```

Each service uses `@ather/service-kit` so adding a new one is ~50 lines; see
[`docs/services.md`](./docs/services.md) for the standard layout.

---

## Quickstart

Requires **Node 20+** and **npm 10+** (and Docker if you want local Postgres/Redis).

```bash
# Install all workspaces
npm install

# Build everything
npm run build

# Typecheck everything
npm run typecheck

# Run all tests
npm run test

# Bring up local Postgres + Redis (optional for Phase 0; required from Phase 1)
npm run infra:up

# Run a service in dev mode
npm run dev:auth        # http://localhost:4001
npm run dev:profile     # http://localhost:4002
npm run dev:web         # http://localhost:3000
```

> **Note:** Phase 0 services use **in-memory stores** so the scaffold is runnable without
> Postgres. Phase 1 swaps the `*Store` implementations for real Postgres-backed ones — the
> interfaces are intentionally narrow so the swap is mechanical.

---

## Try it (no install)

A 60-second smoke test against the auth service:

```bash
# Terminal 1 — start auth service
cp services/auth/.env.example services/auth/.env
npm run dev:auth

# Terminal 2 — exercise it
curl -s -X POST http://localhost:4001/auth/register \
  -H 'content-type: application/json' \
  -d '{"handle":"alice_01","email":"a@example.com","password":"correct horse battery staple","displayName":"Alice"}' | jq

# Capture the access token from the response, then:
curl -s http://localhost:4001/auth/me -H "authorization: Bearer $TOKEN" | jq
```

---

## Design docs (the meat)

| Doc | What's in it |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | 8-plane system architecture, services, comms patterns |
| [`docs/api.md`](docs/api.md)                 | Phase 1 REST + GraphQL + WS endpoints |
| [`docs/database.md`](docs/database.md)       | Per-service Postgres schemas, ledger preview |
| [`docs/security.md`](docs/security.md)       | OAuth2/JWT, E2EE, threat model, compliance |
| [`docs/scaling.md`](docs/scaling.md)         | AWS topology, scaling milestones 1M → 1B |
| [`docs/monetization.md`](docs/monetization.md) | Take rates, ledger, growth strategy |
| [`docs/roadmap.md`](docs/roadmap.md)         | 6-phase roadmap, hard realities, what we **won't** build |

---

## Hard realities, on purpose

The original product brief asked for ~20 platforms × 20 layers × 5 phases at once. That ships
nothing. This repo commits to a **Core Loop MVP** (Identity → Feed → Messaging → AI Assistant →
Notifications) and explicitly defers/rejects items like AI digital twins, autonomous
self-deploying systems, shadow-network contact scraping, on-platform investment products, and
"200+ microservices from day one." See [`docs/roadmap.md`](docs/roadmap.md).

---

## License

TBD. Until a license is added, all rights reserved by the repository owner.
