# Database Schema — Phase 1

Each service owns its Postgres schema. **No cross-service joins.** Cross-service reads happen via APIs or via read models projected from Kafka events.

## Identity service

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle        CITEXT UNIQUE NOT NULL,
  email         CITEXT UNIQUE,
  phone         TEXT UNIQUE,
  password_hash TEXT NOT NULL,         -- argon2id
  status        TEXT NOT NULL DEFAULT 'active',  -- active|suspended|deleted
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  bio           TEXT,
  avatar_url    TEXT,
  persona_type  TEXT NOT NULL DEFAULT 'personal',  -- personal|professional|anonymous
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE personas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('personal','professional','anonymous')),
  visibility    TEXT NOT NULL DEFAULT 'public',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint   TEXT NOT NULL,
  trust_score   INT  NOT NULL DEFAULT 50,
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

CREATE TABLE refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id     UUID REFERENCES devices(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Social service

```sql
CREATE TABLE follows (
  follower_id   UUID NOT NULL,
  followee_id   UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX follows_followee_idx ON follows (followee_id, created_at DESC);

CREATE TABLE blocks (
  blocker_id    UUID NOT NULL,
  blocked_id    UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
```

## Content service

```sql
CREATE TABLE posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('text','image','video','reel','poll','story')),
  body          TEXT,
  media_id      UUID,
  visibility    TEXT NOT NULL DEFAULT 'public',  -- public|followers|close|custom
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX posts_author_idx ON posts (author_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE reactions (
  post_id       UUID NOT NULL,
  user_id       UUID NOT NULL,
  kind          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, kind)
);

CREATE TABLE comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL,
  parent_id     UUID,
  author_id     UUID NOT NULL,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX comments_post_idx ON comments (post_id, created_at);
```

## Media service

```sql
CREATE TABLE media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('image','video','audio')),
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending|ready|failed
  original_url  TEXT NOT NULL,
  variants      JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms   INT,
  dims          JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Communication service

```sql
CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          TEXT NOT NULL CHECK (kind IN ('dm','group','channel')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_members (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member',
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at    TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

-- Server stores ciphertext only; plaintext never touches the DB.
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id       UUID NOT NULL,
  body_ciphertext BYTEA,
  media_id        UUID,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_idx ON messages (conversation_id, created_at DESC);
```

## Notification service

```sql
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  kind         TEXT NOT NULL,
  payload      JSONB NOT NULL,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notif_user_idx ON notifications (user_id, created_at DESC);
```

## Feed (read model)

```sql
CREATE TABLE feed_entries (
  user_id      UUID NOT NULL,
  post_id      UUID NOT NULL,
  score        DOUBLE PRECISION NOT NULL,
  reason       JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX feed_user_score_idx ON feed_entries (user_id, score DESC);
```

## Phase 2+ (preview)

- `communities`, `community_members`, `roles`, `permissions`, `threads`
- `stories`, `reels`, `live_sessions`

## Phase 3+ (preview, double-entry ledger)

- `accounts (id, owner_id, kind, currency)`
- `journal_entries (id, ts, memo, idempotency_key UNIQUE)`
- `journal_lines (entry_id, account_id, amount_minor, side CHECK side IN ('debit','credit'))`
- Invariant: `SUM(debits) = SUM(credits)` per `journal_entries.id`.
