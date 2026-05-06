# Ather

> **Omni-Social Operating System** — a unified identity, social, communication, and creator
> platform. This repo is the **Phase 0 monorepo scaffold** for the Core Loop MVP.

The full design blueprint (architecture, API, schema, security, scaling, monetization, roadmap)
lives in [`/docs`](./docs).

---

## What's in this repo

```
ather/
├── apps/
│   └── web/                 # Next.js 15 App Router — Phase 1 screen shell
├── services/
│   ├── auth/                # Express + TS — register/login/refresh/logout/me, JWT, single-use refresh
│   └── profile/             # Express + TS — profile read/update, by-handle lookup
├── packages/
│   └── shared/              # Shared TypeScript types and API contracts
├── infra/
│   ├── docker-compose.yml   # Local Postgres + Redis
│   └── postgres/init.sql    # Per-service Postgres schemas
├── docs/                    # Architecture, API, DB, security, scaling, monetization, roadmap
└── .github/workflows/ci.yml # Typecheck · build · test
```

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
