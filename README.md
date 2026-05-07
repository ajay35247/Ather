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

### Android (Capacitor) + web static artifacts

Android app wrapper is configured in `apps/web` with:
- App ID: `com.omniverse.app`
- App Name: `omniverse`

Build commands:

```bash
# Build Next.js static export for mobile and sync to Android project
npm --workspace @ather/web run build:mobile

# Build APKs (debug + unsigned release)
npm --workspace @ather/web run android:apk:debug
npm --workspace @ather/web run android:apk:release

# Build unsigned release AAB
npm --workspace @ather/web run android:aab:release
```

CI workflow `.github/workflows/web-android-artifacts.yml` uploads:
- `web-static-out` (from `apps/web/out`)
- `android-apk-aab-unsigned` (debug APK, unsigned release APK, unsigned release AAB)

For Play-ready signed release artifacts, add these GitHub Actions secrets:
- `ANDROID_KEYSTORE_BASE64` — base64-encoded `.jks` or `.keystore`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

When all four secrets are present, the same workflow also builds and uploads:
- `android-apk-aab-signed` (signed release APK + signed release AAB)

Signed builds are only attempted outside `pull_request` runs. Release signing is injected at build time via Gradle project properties, so no keystore or password is committed to the repository.

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

TBD. Until a license is added, all rights reserved by the repository owner. The
extended product reference below reflects the unified-social-platform draft and
is preserved for context; license and stack details there are non-binding.

---

# Reference: Unified Social Platform draft

> **One platform for everything social.** Chat, create, stream, discover, and earn — all inside Ather.

Ather is an open-source, AI-first, unified social super-app that intelligently combines the core features of the world's leading platforms — YouTube, TikTok, Instagram, WhatsApp, Telegram, Reddit, Discord, LinkedIn, Twitch, and more — into a single, cohesive, privacy-first digital ecosystem.

---

## 🌍 Vision

> Build a platform where one user = one universal identity, AI assists every interaction, and content becomes structured knowledge — scaling to billions of users.

---

## ✨ Core Features

| Category | Features |
|---|---|
| **Feed & Content** | Infinite scroll, posts, reels, stories, polls, image/video, algorithm + chronological toggle |
| **Messaging** | Private chat, group chat, broadcast channels, disappearing messages, voice/video calls |
| **Communities** | Reddit-style threads, Discord-style servers, role-based permissions, AI moderation |
| **Live Streaming** | Live video with real-time chat, viewer counts, gifts system |
| **Creator Economy** | Monetization dashboard, ad revenue sharing, paid subscriptions, tips |
| **Profiles** | Personal + professional identity, portfolio, resume builder |
| **Search** | Global search across posts, users, communities |
| **Notifications** | Real-time push notifications, smart priority filtering |
| **Privacy & Security** | End-to-end encryption, 2FA, biometric login, granular controls |

---

## 🏗️ Architecture

### Monorepo Structure

```
Ather/
├── apps/
│   ├── web/          # Next.js 14 frontend (React, Tailwind CSS)
│   └── api/          # Node.js + Express backend (TypeScript)
├── packages/
│   └── shared/       # Shared TypeScript types
├── docker-compose.yml
└── package.json      # Workspace root
```

### Tech Stack

**Frontend (`apps/web`)**
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with dark mode
- **State**: Zustand
- **HTTP**: Axios with JWT auto-refresh
- **Real-time**: Socket.IO client

**Backend (`apps/api`)**
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express 4
- **Real-time**: Socket.IO (WebSockets)
- **Auth**: JWT (access + refresh tokens, bcrypt)
- **Validation**: express-validator
- **Security**: Helmet, CORS, rate limiting

**Infrastructure**
- **Database**: PostgreSQL (via Prisma ORM)
- **Cache**: Redis
- **Message Bus**: Kafka (event streaming)
- **Search**: ElasticSearch
- **Storage**: S3-compatible object storage
- **CDN**: Cloudflare
- **Deploy**: Docker Compose / Kubernetes

---

## 🗄️ Database Schema

### Core Tables

```sql
-- Universal Identity
users (id, username, display_name, email, password_hash, avatar, bio,
       is_verified, is_private, reputation, followers_count, following_count,
       posts_count, created_at)

-- Social Graph
follows (follower_id, following_id, created_at)

-- Content
posts (id, author_id, type, content, media_urls, tags, visibility,
       likes_count, comments_count, shares_count, created_at)
comments (id, post_id, author_id, content, parent_id, likes_count, created_at)
likes (user_id, post_id, created_at)
bookmarks (user_id, post_id, created_at)

-- Messaging
conversations (id, type, name, created_at)
conversation_participants (conversation_id, user_id, role, joined_at)
messages (id, conversation_id, sender_id, type, content, media_url,
          is_read, is_deleted, created_at)

-- Communities
communities (id, name, slug, description, category, members_count,
             posts_count, is_private, creator_id, created_at)
community_members (community_id, user_id, role, joined_at)

-- Notifications
notifications (id, user_id, type, actor_id, target_id, message,
               is_read, created_at)
```

---

## 🔌 API Endpoints

### Authentication (`/api/auth`)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/register` | Create account |
| `POST` | `/login` | Sign in |
| `POST` | `/refresh` | Refresh access token |
| `GET`  | `/me` | Get current user |
| `POST` | `/logout` | Sign out |

### Users (`/api/users`)
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/` | Search users |
| `GET`  | `/:username` | Get user profile |
| `PATCH`| `/me` | Update profile |
| `POST` | `/:id/follow` | Follow user |
| `DELETE`| `/:id/follow` | Unfollow user |

### Posts (`/api/posts`)
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/` | List posts (paginated) |
| `POST` | `/` | Create post |
| `GET`  | `/:id` | Get post |
| `DELETE`| `/:id` | Delete post |
| `POST` | `/:id/like` | Like post |
| `DELETE`| `/:id/like` | Unlike post |
| `POST` | `/:id/comments` | Add comment |
| `GET`  | `/:id/comments` | Get comments |
| `POST` | `/:id/bookmark` | Bookmark post |

### Feed (`/api/feed`)
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/` | Personalized feed. Query params: `mode=ranked\|chronological`, `type=reel\|post\|story`, `cursor`, `limit` |
| `GET`  | `/trending` | Top posts by engagement (Explore tab) |

### Messages (`/api/messages`)
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/conversations` | List conversations |
| `POST` | `/conversations` | Start conversation |
| `GET`  | `/conversations/:id` | Get conversation + messages |
| `POST` | `/conversations/:id/messages` | Send message |
| `PATCH`| `/conversations/:id/messages/:msgId/read` | Mark as read |

### Communities (`/api/communities`)
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/` | List communities |
| `POST` | `/` | Create community |
| `GET`  | `/:slug` | Get community |
| `POST` | `/:id/join` | Join community |
| `DELETE`| `/:id/join` | Leave community |

### Notifications (`/api/notifications`)
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/` | Get notifications |
| `PATCH`| `/:id/read` | Mark as read |
| `PATCH`| `/read-all` | Mark all as read |

### AI Assistant (`/api/ai`)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat` | Chat with personal AI assistant (with persistent history) |
| `GET`  | `/chat/history` | Retrieve chat history |
| `DELETE`| `/chat/history` | Clear chat history |
| `POST` | `/smart-replies` | Get 3 short suggested replies for a message |
| `POST` | `/moderate` | Run content moderation (banned terms, shouting, length) |
| `POST` | `/summarize` | Summarize a long piece of text |
| `POST` | `/caption` | Generate caption suggestions for a topic |

### Monetization (`/api/monetization`)
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/wallet` | Get wallet balance and totals |
| `POST` | `/wallet/topup` | Add funds (demo — integrate Stripe/Razorpay) |
| `POST` | `/tip` | Send a tip to another user |
| `GET`  | `/transactions` | Recent transactions |
| `POST` | `/subscriptions` | Subscribe to a creator (basic / premium / vip) |
| `DELETE`| `/subscriptions/:id` | Cancel a subscription |
| `GET`  | `/subscriptions` | List my subscriptions |
| `GET`  | `/earnings` | Creator earnings dashboard |

### Live Streaming (`/api/live`)
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/` | List active live streams |
| `POST` | `/` | Start a live stream |
| `GET`  | `/:id` | Get stream details |
| `POST` | `/:id/join` | Join as a viewer |
| `POST` | `/:id/leave` | Leave the stream |
| `POST` | `/:id/end` | End the stream (host only) |

### Mini Apps (`/api/mini-apps`)
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/` | Browse mini-app catalog |
| `GET`  | `/installed` | List installed mini-apps |
| `POST` | `/:id/install` | Install a mini-app |
| `DELETE`| `/:id/install` | Uninstall a mini-app |

### Identity (`/api/identity`)
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/` | Get identity record (persona, DID, reputation) |
| `POST` | `/persona` | Switch active persona (`personal`/`professional`/`anonymous`) |
| `POST` | `/did` | Link a W3C DID (`did:method:id`) |
| `DELETE`| `/did` | Unlink the linked DID |
| `GET`  | `/reputation/:userId` | Get any user's reputation score (0–100) |

### Wellbeing (`/api/wellbeing`)
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/` | Current wellbeing settings + today's usage |
| `PUT`  | `/limit` | Set daily usage limit (minutes) |
| `PUT`  | `/focus` | Toggle focus mode |
| `POST` | `/track` | Report active session minutes |
| `PUT`  | `/legacy` | Configure digital legacy contacts (max 5) and inactivity threshold |

---

## 🔄 Real-time Events (Socket.IO)

```
Client → Server:
  join:conversation     Join a chat room
  leave:conversation    Leave a chat room
  message:send          Send a message
  message:typing        Typing indicator
  live:start            Start a live stream
  live:end              End a live stream
  live:join             Join a stream room
  live:chat             Send live chat message

Server → Client:
  message:new           New message received
  message:typing        User is typing
  live:new              New stream started
  live:ended            Stream ended
  live:viewer_joined    New viewer joined
  live:chat_message     Live chat message
  user:online           User came online
  user:offline          User went offline
```

---

## 🚀 Development Setup

### Prerequisites
- Node.js 20+
- Docker + Docker Compose (for databases)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/ajay35247/Ather.git
cd Ather

# Install all dependencies (workspaces)
npm install

# Start databases (PostgreSQL + Redis)
docker-compose up db redis -d

# Copy environment files
cp apps/api/.env.example apps/api/.env

# Start development servers
npm run dev
```

- **Web**: http://localhost:3000
- **API**: http://localhost:4000
- **API Health**: http://localhost:4000/health

### Running Tests

```bash
# API tests
cd apps/api && npm test

# Type check
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

### Production with Docker

```bash
docker-compose up --build
```

---

## 📱 Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Sign in |
| `/register` | Create account |
| `/feed` | Main feed (posts + reels) |
| `/messages` | Unified inbox |
| `/communities` | Browse & create communities |
| `/live` | Live streaming |
| `/profile` | User profile |
| `/notifications` | Notifications center |
| `/search` | Global search |

---

## 🗺️ Development Roadmap

### Phase 1 — MVP (Current)
- [x] Authentication (JWT, bcrypt, refresh tokens)
- [x] User profiles with follow system
- [x] Post feed (text, image, video, reels)
- [x] Like, comment, bookmark, share
- [x] Messaging (direct + group conversations)
- [x] Communities
- [x] Live streaming UI
- [x] Notifications system
- [x] Real-time via Socket.IO
- [x] REST API with TypeScript
- [x] Next.js frontend with Tailwind CSS
- [x] Docker deployment

### Phase 2 — AI & Media ✅
- [x] AI-powered feed recommendation engine (`mode=ranked` scoring: recency × engagement × tag affinity)
- [x] Trending feed endpoint (Explore tab)
- [x] Reels content type with type filter
- [x] AI content moderation (banned terms, shouting, length heuristics)
- [x] Smart reply suggestions
- [ ] Video upload + processing pipeline (FFmpeg) — infra-level, deferred
- [ ] Stories (24-hour ephemeral content) — schema-ready, UI pending
- [ ] Full-text search (ElasticSearch) — infra-level, deferred

### Phase 3 — Creator Economy ✅
- [x] Wallet with balance, total earned, total spent
- [x] Tips between users with note + insufficient-funds protection
- [x] Subscriptions (basic / premium / vip tiers) with cancellation
- [x] Creator earnings dashboard
- [x] Transactions history
- [x] Live streaming (start / join / leave / end with viewer counts)
- [x] Wallet UI with top-up flow
- [ ] Real Stripe / Razorpay integration — replaces in-memory wallet in production

### Phase 4 — Advanced AI ✅
- [x] Personal AI assistant per user with persistent chat history
- [x] AI-generated captions for content
- [x] Auto-summarize long text (`/api/ai/summarize`)
- [x] Mini-apps ecosystem (WeChat-style) with 6 curated apps
- [x] Per-user install / uninstall flow with permission disclosure
- [ ] Voice-to-text + text-to-video — model-level, deferred
- [ ] Behavior-aware churn prediction — analytics-level, deferred

### Phase 5 — Platform & Scale ✅
- [x] Web3 identity layer: W3C-compliant DID linking (`did:method:id`)
- [x] Multi-persona system (personal / professional / anonymous)
- [x] Reputation scoring (0–100 from profile completeness + engagement)
- [x] Digital wellbeing: daily limits, focus mode, screen-time tracking
- [x] Digital legacy: trusted contacts + inactivity threshold
- [x] Settings page covering identity, Web3, and wellbeing
- [ ] AR/VR interfaces (metaverse-ready) — client-platform deferred
- [ ] Multi-region Kubernetes deployment — ops-level, deferred
- [ ] Edge computing + offline-first sync — infra-level, deferred

---

## 🔐 Security

- **Authentication**: JWT access tokens (15 min) + refresh tokens (30 days)
- **Password hashing**: bcrypt with 12 salt rounds
- **Rate limiting**: 200 requests per 15-minute window per IP
- **HTTP security**: Helmet (CSP, HSTS, XSS protection)
- **Input validation**: express-validator on all endpoints
- **CORS**: Strict origin whitelist
- **Socket.IO**: JWT-authenticated connections

---

## 🌐 Scaling Strategy

| Scale | Strategy |
|-------|----------|
| **0–10K users** | Single server, PostgreSQL, in-memory cache |
| **10K–1M users** | Horizontal API scaling, Redis, CDN |
| **1M–50M users** | Kafka event streaming, ElasticSearch, read replicas |
| **50M–1B users** | Multi-region deployment, data sharding, edge functions |

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and open a PR.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

MIT License

---

<p align="center">Built for the next billion users. 🌍</p>
