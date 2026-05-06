# Architecture — Ather Omni-Social OS

> Status: **Phase 0 — Foundations.** This document is the canonical high-level design. Sub-systems are implemented incrementally per the [roadmap](./roadmap.md).

## 1. Guiding Principles

1. **Ship the Core Loop first.** Identity → Feed → Messaging → AI Assistant → Notifications. Defer everything else.
2. **One store per concern.** Polyglot persistence, not a god-database.
3. **Events are the spine.** Services own their data and publish facts to Kafka; consumers project read models.
4. **Privacy is a constraint, not a feature.** E2EE, regional residency, and data export are non-negotiable.
5. **Anti-addiction by design.** Ethical defaults; user controls visible.
6. **Start with ~12 services.** Split when ownership/scale demands it — never as a goal.

## 2. The 8 Planes

| Plane          | Purpose                                                                  | Phase |
|----------------|--------------------------------------------------------------------------|-------|
| Edge           | CDN, API gateway, WAF, rate limit, GraphQL federation, WS gateway        | 0–1   |
| Identity       | Auth, profiles, personas, reputation, sessions, device trust             | 0–1   |
| Social         | Social graph, follows, blocks, groups, communities                       | 1–2   |
| Content        | Posts, reels, stories, media pipeline, feed ranking, search              | 1–2   |
| Communication  | Chat, calls (SFU), live streaming, notifications, presence               | 1–3   |
| Intelligence   | Recommendation, moderation, embeddings, AI agent, semantic search        | 1–4   |
| Economy        | Wallet, payments, subscriptions, tips, ads, payouts, ledger              | 3     |
| Platform       | Admin, analytics, feature flags, A/B, observability, mini-app SDK        | 0–4   |

## 3. Communication Patterns

- **Client → Edge:** GraphQL (federated) for product reads/writes; REST for auth and webhooks; WebSockets for chat, presence, notifications; SSE for AI streaming.
- **Service → Service (sync):** gRPC with mTLS; tight SLOs; circuit breakers.
- **Service → Service (async):** Kafka topics, schemas in a registry; CDC via Debezium where outbox is impractical.
- **Outbox pattern** for write-then-publish to avoid dual-write inconsistencies.

## 4. Phase 1 Microservices

```
                ┌──────────────┐
                │  API Gateway │  (Kong/Envoy + GraphQL Gateway)
                └──────┬───────┘
        ┌───────┬──────┼──────┬─────────┬─────────┬──────────┐
        ▼       ▼      ▼      ▼         ▼         ▼          ▼
      auth  profile social  post     feed      media     chat/presence
                            comments search   moderation notification
                                              ai-assistant
```

Twelve services in Phase 1. Each owns its Postgres schema. All publish to / consume from Kafka.

## 5. Cross-Cutting Concerns

- **AuthN/AuthZ:** OAuth2 + PKCE; short-lived JWT (5 min) + rotating, device-bound refresh; service-to-service mTLS via SPIFFE/SPIRE.
- **Schema registry:** Confluent-compatible; backward-compatible evolution required for any topic with consumers.
- **Audit log:** Append-only, tamper-evident; covers admin + privacy-sensitive operations.
- **Feature flags:** Multi-tenant, percentage + cohort + region targeting; flag changes audited.
- **Secrets:** AWS Secrets Manager / Vault; no plaintext in env files in any non-dev environment.
- **Observability:** OpenTelemetry traces/metrics/logs with consistent `trace_id`. SLOs per service; error budgets gate releases.

## 6. Reference C4 (informal)

- **System Context:** Users, Creators, Brands, Admins, Third-party developers (Phase 4+).
- **Container:** API Gateway, 12 services, Postgres-per-service, Redis cluster, Kafka, S3, ES, pgvector, ClickHouse.
- **Component:** see service-level READMEs as they land.

## 7. Non-Goals (Phase 0/1)

Explicitly out of scope for now: live streaming, audio rooms, mini-apps, Web3 identity, AR/VR, AI digital twins, autonomous agents, on-platform investment products. See [roadmap](./roadmap.md) §Hard Realities.
