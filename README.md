# Ather — Unified Social Platform

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
| `GET`  | `/` | Get personalized feed |

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

### Phase 2 — AI & Media
- [ ] AI-powered feed recommendation engine
- [ ] Video upload + processing pipeline (FFmpeg)
- [ ] Stories (24-hour ephemeral content)
- [ ] Polls and interactive posts
- [ ] AI content moderation (toxicity, NSFW)
- [ ] Smart reply suggestions
- [ ] Full-text search (ElasticSearch)

### Phase 3 — Creator Economy
- [ ] Monetization dashboard
- [ ] Stripe/Razorpay payment integration
- [ ] Paid subscriptions + gated content
- [ ] Tips / gifts system
- [ ] Ad revenue sharing
- [ ] Analytics for creators

### Phase 4 — Advanced AI
- [ ] Personal AI assistant per user
- [ ] Auto-generate captions + content
- [ ] Voice-to-text + text-to-video
- [ ] AI-based churn prediction
- [ ] Behavior-aware personalization

### Phase 5 — Platform & Scale
- [ ] Mini-apps ecosystem (WeChat-style)
- [ ] Bot API (Telegram-style)
- [ ] Web3 identity (DID, SSI)
- [ ] AR/VR interfaces (metaverse-ready)
- [ ] Multi-region Kubernetes deployment
- [ ] Edge computing + offline-first sync

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
