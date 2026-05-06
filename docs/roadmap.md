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

## Phase 0 acceptance (this PR)

- [x] Monorepo scaffolded (npm workspaces, TS base config).
- [x] `apps/web` Next.js skeleton.
- [x] `services/auth` Express + TS skeleton with register/login/refresh/me + tests.
- [x] `services/profile` Express + TS skeleton with me/update + tests.
- [x] `packages/shared` shared types.
- [x] `infra/docker-compose.yml` for local Postgres + Redis.
- [x] CI: typecheck, lint-light, build, tests.
- [x] Architecture, API, DB, security, scaling, monetization docs.
