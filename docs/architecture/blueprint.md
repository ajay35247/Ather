# Ather — God-Level Enterprise Blueprint

This document captures the long-term target architecture. The current repo
is intentionally a **subset** of this blueprint — we ship what we need for
the current phase (see [Scaling phases](#scaling-phases) below) and leave
forward placeholders only where they are documented and discoverable.

## Top-level layout (target)

```
.
├── apps/                # user-facing surfaces (mobile, web, desktop, tv, watch, vr, ar)
├── services/            # backend microservices — every dir is *-service
├── packages/            # shared TS libraries (service-kit, shared, i18n, india, ...)
├── ai/                  # offline training, inference notebooks, model weights
├── databases/           # per-engine schema docs (postgres, mongo, redis, es, vector, clickhouse)
├── gateway/             # api-gateway + edge-gateway (cloudflare / cdn)            ← reserved
├── event-streaming/     # kafka topics / consumers / producers / event-bus         ← reserved
├── cloud/               # per-cloud IaC (aws / gcp / azure)                        ← reserved
├── infra/               # portable IaC: docker / k8s / helm / terraform / nginx
├── security/            # zero-trust, compliance, gdpr, dpdp-india, IR             ← reserved
├── analytics/           # dashboards / BI / experimentation                        ← reserved
├── testing/             # cross-cutting load / chaos / e2e harnesses               ← reserved
├── docs/                # architecture, API, schemas, roadmap
├── scripts/             # migrations, seeders, deployment helpers
├── legal/               # terms, privacy, creator + moderation policy              ← reserved
├── future-tech/         # web3 / metaverse / BCI / autonomous agents               ← reserved
└── .github/workflows/   # ci, lint, tests, security-scan, docker, deploy, cd
```

Each directory marked **← reserved** has a `README.md` with its full
proposed sub-tree, so the structure is discoverable via `tree` / `ls`
without polluting the repo with hundreds of empty stubs.

## Scaling phases

### Phase 1 — Startup MVP (1K–100K users)
- Monolith API at `apps/api` + per-pillar microservice.
- Postgres + Redis (`infra/docker-compose.yml`).
- Simple feed (chronological + ranker v1 fallback).
- Basic chat (`services/chat-service`).
- Single-region Helm deploy (`infra/helm/_service` + `.github/workflows/deploy.yml`).

### Phase 2 — Growth (100K–10M users)
- Promote remaining pillars out of `apps/api` into their own `*-service`.
- Kafka via `event-streaming/` (Redpanda dev → MSK / Confluent prod).
- CDN edge via `gateway/edge-gateway/`.
- Kubernetes autoscaling (HPA + PDB already in `_service` chart).
- AI ranking online (LightGBM / Triton served from `ai/inference/`).
- Distributed cache (Redis cluster).

### Phase 3 — Global scale (10M–1B users)
- Multi-region infra in `cloud/{aws,gcp,azure}`.
- Edge compute for personalisation.
- Vector DB (`services/vector-search-service` → Milvus / Pinecone).
- Real-time ML pipelines (`ai/pipelines/` — to be added under the existing `ai/` tree).
- Global failover, autonomous scaling, chaos-engineered.

## Core loop

```
User opens app
    → AI understands intent       (ai-assistant-service, vector-search-service)
    → Feed personalises           (feed-service, ranking-service via ai-ml/)
    → Creator publishes           (post-service, media-service, creator-studio-service)
    → Community engages           (communities-service, groups-service, audio-rooms-service)
    → Messaging retains           (chat-service, presence-service, notification-service)
    → Monetisation activates      (wallet-service, payments-service, subscriptions-service,
                                   tips-service, ads-service, ledger-service)
    → AI learns                   (analytics-service → ai/training/)
    → Platform improves           (experimentation in growth-services)
    → Infinite growth loop
```

## What's intentionally *not* in this repo (yet)

- `microservices/` as an alias for `services/` — kept as `services/` only.
- `ai-ml/` as a separate dir — folded into the existing `ai/` directory
  which already covers training / inference / models / datasets / notebooks.
- `design-system/` as a top-level dir — already at `packages/design-system`.
- `ci-cd/` as a top-level dir — already at `.github/workflows/`.

These are listed in this blueprint for completeness but are **not** going
to be created as duplicate directories.
