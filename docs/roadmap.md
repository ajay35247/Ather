# Roadmap

| Phase | Duration | Goal | Exit criteria |
|-------|----------|------|---------------|
| 0 — Foundations    | 6 wks  | Repo, CI/CD, infra-as-code, observability, auth + profile | Internal users can sign up and post |
| 1 — Core loop MVP  | 3 mo   | Feed, posts, DMs, notifications, basic AI assistant, moderation | Closed beta, 10k DAU, p95 feed <300ms |
| 2 — Media + community | 3 mo | Reels pipeline, stories, communities, recommendations, search | Public launch in 1 region, 1M MAU |
| 3 — Monetization   | 4 mo   | Wallet, tips, subs, ads, live streaming, creator studio | First $1M GMV, payout system audited |
| 4 — Ecosystem      | 6 mo   | Mini-apps SDK, bot platform, semantic search, agent-assisted creation | 100 third-party apps live |
| 5 — Frontier       | ongoing| Web3 identity (opt-in), AR/VR, advanced agents, digital legacy | Gated by safety + regulatory readiness |

## Hard Realities (deferred / rejected)

The following items from the original prompt are explicitly **not** in scope and will not be built without a dedicated safety, legal, and product review:

- AI digital twins / clones / "AI acts before user input" — consent + liability unsolved.
- "Self-evolving" autonomous A/B and feature launches — AI proposes, humans approve.
- Tokenized engagement / on-platform "AI investment income" — securities/gambling regulation.
- Shadow network building from non-users' contacts — violates GDPR/DPDP.
- "Personality preservation after death" — opt-in memorialization only, no generative impersonation.
- "200+ microservices from day one" — start with ~12, split when ownership/scale demands.
- Competing with Meta + Google + ByteDance simultaneously — pick one wedge, win it, expand.

## Phase 0 acceptance (delivered)

- [x] Monorepo scaffolded (npm workspaces, TS base config).
- [x] `apps/web` Next.js skeleton.
- [x] `services/auth-service` Express + TS skeleton with register/login/refresh/me + tests.
- [x] `services/profile-service` Express + TS skeleton with me/update + tests.
- [x] `packages/shared` shared types.
- [x] `infra/docker-compose.yml` for local Postgres + Redis.
- [x] CI: typecheck, lint-light, build, tests.
- [x] Architecture, API, DB, security, scaling, monetization docs.

## Phase 1 acceptance (delivered)

Core loop MVP — all 10 services scaffolded, tested, and reachable from
the BFF in `apps/api`. Per-service surface in
[`docs/services.md`](./services.md).

- [x] `services/social-graph-service` (4003) — follow / unfollow / block / followers / following.
- [x] `services/post-service` (4004) — CRUD + reactions, URL allowlist on media.
- [x] `services/feed-service` (4005) — for_you / following / chronological with the
      production-grade ranker pillar (see [`docs/feed-pillar.md`](./feed-pillar.md)).
- [x] `services/media-service` (4006) — upload-url / finalize / by-id.
- [x] `services/chat-service` (4007) — conversations + messages, **server stores
      ciphertext only** (Signal-style E2EE).
- [x] `services/presence-service` (4008) — heartbeat / get / bulk.
- [x] `services/notification-service` (4009) — list / unread-count / mark-read,
      internal push gated by `x-internal-secret`.
- [x] `services/search-service` (4010) — substring index over users + posts.
- [x] `services/moderation-service` (4011) — classify / report / queue.
- [x] `services/ai-assistant-service` (4012) — chat (SSE) / summarize / suggest-reply
      / generate-caption with quota.
- [x] **DB**: production schema for the feed pillar
      (`infra/postgres/migrations/0001_feed_pillar.sql`) +
      messaging / blocks / notifications / audit log
      (`infra/postgres/migrations/0002_messaging_and_social.sql`).
- [x] **Cross-service E2E test** exercises signup → follow → post → feed →
      react → notify in one flow
      (`apps/api/src/__tests__/core-loop.e2e.test.ts`).

## Phase 2 acceptance (delivered)

Media + community — 8 additional services with the same conventions.

- [x] `services/post-service` (4020) — short-form video CRUD + list.
- [x] `services/post-service` (4021) — create / active / by-author.
- [x] `services/post-service` (4022) — create / by-post / delete.
- [x] `services/communities-service` (4023) — create / by-slug / join / members / role.
- [x] `services/groups-service` (4024) — create / get / add member.
- [x] `services/ranking-service` (4025) — linear reranker stub.
- [x] `services/recommendations-service` (4026) — cosine-based two-tower stub.
- [x] `services/content-events-service` (4027) — Kafka shim, internal-only writes.
- [x] **DB**: production schema for communities, groups, search, KG, i18n
      (`infra/postgres/migrations/0004_platform.sql`).

## Phase 3 acceptance (delivered)

Monetization — 10 services and the **double-entry ledger** as the source
of truth for all money in the system.

- [x] `services/wallet-service` (4030) — read projection, internal-only writes.
- [x] `services/payments-service` (4031) — intents + webhooks/confirm.
- [x] `services/subscriptions-service` (4032) — subscribe / cancel / me.
- [x] `services/tips-service` (4033) — send / received.
- [x] `services/ads-service` (4034) — campaigns CRUD + status.
- [x] `services/creator-studio-service` (4035) — me.
- [x] `services/live-stream-service` (4036) — start / end / active.
- [x] `services/audio-rooms-service` (4037) — create / join / close / open.
- [x] `services/analytics-service` (4038) — track / count.
- [x] `services/ledger-service` (4039) — accounts / entries / balance / health-check
      enforcing the double-entry invariant in code **and** in the DB
      (deferred constraint trigger; see `0003_monetization.sql`).
- [x] **DB**: production schema for wallet, payments, subscriptions, tips,
      ads, the double-entry ledger, and partitioned analytics events
      (`infra/postgres/migrations/0003_monetization.sql`).

## Phase 4 acceptance (delivered)

Ecosystem — 7 services with strict allowlists / sandboxes.

- [x] `services/mini-app-runtime-service` (4050) — register / approve / approved
      with a hard capability allowlist (`ALLOWED_CAPS`).
- [x] `services/plugin-marketplace-service` (4051) — list / install / search.
- [x] `services/bot-platform-service` (4052) — register / by-handle, **HTTPS-only
      webhooks** enforced both in code and via a `CHECK` constraint.
- [x] `services/knowledge-graph-service` (4053) — entities / edges / neighbors.
- [x] `services/vector-search-service` (4054) — upsert / query.
- [x] `services/agent-orchestrator-service` (4055) — plans, tool allowlist enforced.
- [x] `services/translation-service` (4056) — translate stub backed by `@ather/i18n`.
- [x] **Generic Helm chart** at `infra/helm/_service/` + per-service values
      under `infra/helm/values/<service>.yaml` (37 files, all render via
      `helm template`); generic deploy workflow at
      `.github/workflows/deploy.yml` (gated on
      `vars.DEPLOY_ENABLED`).

## Phase 5 — deferred by policy

See [`docs/phase5-deferral.md`](./phase5-deferral.md). No code, no
service folders. The deferral is auditable and per-capability gated on:
documented threat model, regulatory sign-off, reversibility, operational
readiness, and validated user need.
