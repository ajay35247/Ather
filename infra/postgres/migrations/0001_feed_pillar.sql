-- =====================================================================
-- Migration 0001: Feed Pillar — production schema
--
-- Owner planes: identity, social, content, media, feed.
-- Idempotent: every CREATE uses IF NOT EXISTS or guarded blocks.
-- All money is numeric (no float). All ids are UUID. created_at is
-- timestamptz. PII columns are hashable (see identity.users.email_hash).
--
-- Sharding strategy:
--   * Up to ~100M users: single primary + read replicas; PgBouncer in front.
--   * Beyond:  shard `content.posts`, `content.comments`, and
--              `feed.entries` by hash(user_id) using Citus or app-level
--              routing. social.follows is two-way indexed so it can be
--              sharded by either follower_id or followee_id.
--
-- pgvector is optional. Enable in environments that have it; the
-- embedding column is added in a guarded DO block.
-- =====================================================================

BEGIN;

-- --- extensions (already attempted in init.sql; safe to re-run) ----
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- --- schemas (idempotent) ------------------------------------------
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS social;
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS media;
CREATE SCHEMA IF NOT EXISTS feed;

-- =====================================================================
-- identity.users
--   * email_hash / phone_hash are SHA-256 of normalized values, so we
--     can do equality lookup without storing raw PII at rest.
--   * handle is citext (case-insensitive unique).
--   * status enforces lifecycle states.
-- =====================================================================
CREATE TABLE IF NOT EXISTS identity.users (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  handle          CITEXT       NOT NULL UNIQUE,
  email_hash      BYTEA        UNIQUE,
  phone_hash      BYTEA        UNIQUE,
  display_name    TEXT         NOT NULL,
  bio             TEXT,
  avatar_url      TEXT,
  locale          TEXT         NOT NULL DEFAULT 'en',
  country         CHAR(2),
  is_creator      BOOLEAN      NOT NULL DEFAULT FALSE,
  status          TEXT         NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','shadowbanned','disabled','deleted')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_search_gin
  ON identity.users
  USING GIN (to_tsvector('simple', coalesce(handle::text,'') || ' ' || coalesce(display_name,'')));

-- =====================================================================
-- social.follows
--   Two indexes so we can answer both "who do I follow" (fanout-on-write)
--   and "who follows X" (fanout-on-read for big creators) cheaply.
-- =====================================================================
CREATE TABLE IF NOT EXISTS social.follows (
  follower_id     UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  followee_id     UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS follows_followee_idx
  ON social.follows (followee_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social.user_counters (
  user_id         UUID         PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  followers_count BIGINT       NOT NULL DEFAULT 0,
  following_count BIGINT       NOT NULL DEFAULT 0,
  posts_count     BIGINT       NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =====================================================================
-- media.media
-- =====================================================================
CREATE TABLE IF NOT EXISTS media.media (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  kind            TEXT         NOT NULL CHECK (kind IN ('image','video','audio')),
  source_key      TEXT         NOT NULL,
  variants        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  width           INT,
  height          INT,
  duration_ms     INT,
  content_hash    BYTEA,
  status          TEXT         NOT NULL DEFAULT 'uploading'
                  CHECK (status IN ('uploading','processing','ready','failed')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_owner_idx ON media.media (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_hash_idx  ON media.media (content_hash) WHERE content_hash IS NOT NULL;

-- =====================================================================
-- content.posts
-- =====================================================================
CREATE TABLE IF NOT EXISTS content.posts (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  kind            TEXT         NOT NULL
                  CHECK (kind IN ('text','image','video','reel','poll','live_replay')),
  body            TEXT         NOT NULL DEFAULT '',
  media_ids       UUID[]       NOT NULL DEFAULT '{}',
  visibility      TEXT         NOT NULL DEFAULT 'public'
                  CHECK (visibility IN ('public','followers','close','private')),
  language        TEXT,
  community_id    UUID,
  reply_to_id     UUID         REFERENCES content.posts(id) ON DELETE SET NULL,
  tags            TEXT[]       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  edited_at       TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  search_vec      TSVECTOR
);

CREATE INDEX IF NOT EXISTS posts_author_created_idx
  ON content.posts (author_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS posts_visibility_created_idx
  ON content.posts (visibility, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS posts_search_gin
  ON content.posts USING GIN (search_vec);
CREATE INDEX IF NOT EXISTS posts_tags_gin
  ON content.posts USING GIN (tags);

-- pgvector embedding (768d, e5-multilingual-large) — only when extension is installed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE 'ALTER TABLE content.posts ADD COLUMN IF NOT EXISTS embedding vector(768)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS posts_embedding_ivfflat
             ON content.posts USING ivfflat (embedding vector_cosine_ops)
             WITH (lists = 200)';
  END IF;
END$$;

-- =====================================================================
-- content.post_metrics — hot counters
-- =====================================================================
CREATE TABLE IF NOT EXISTS content.post_metrics (
  post_id         UUID         PRIMARY KEY REFERENCES content.posts(id) ON DELETE CASCADE,
  views_total     BIGINT       NOT NULL DEFAULT 0,
  views_24h       BIGINT       NOT NULL DEFAULT 0,
  likes           BIGINT       NOT NULL DEFAULT 0,
  comments        BIGINT       NOT NULL DEFAULT 0,
  reposts         BIGINT       NOT NULL DEFAULT 0,
  saves           BIGINT       NOT NULL DEFAULT 0,
  watch_time_ms   BIGINT       NOT NULL DEFAULT 0,
  hot_score       REAL         NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_metrics_hot_idx
  ON content.post_metrics (hot_score DESC, updated_at DESC);

-- =====================================================================
-- content.reactions
-- =====================================================================
CREATE TABLE IF NOT EXISTS content.reactions (
  user_id         UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  post_id         UUID         NOT NULL REFERENCES content.posts(id) ON DELETE CASCADE,
  kind            TEXT         NOT NULL CHECK (kind IN ('like','heart','clap','laugh','wow','sad','angry')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id, kind)
);
CREATE INDEX IF NOT EXISTS reactions_post_idx ON content.reactions (post_id, created_at DESC);

-- =====================================================================
-- content.comments
-- =====================================================================
CREATE TABLE IF NOT EXISTS content.comments (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID         NOT NULL REFERENCES content.posts(id) ON DELETE CASCADE,
  author_id       UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  parent_id       UUID         REFERENCES content.comments(id) ON DELETE CASCADE,
  body            TEXT         NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  edited_at       TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS comments_post_created_idx
  ON content.comments (post_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- =====================================================================
-- feed.entries — materialized timeline rows (push lane).
-- =====================================================================
CREATE TABLE IF NOT EXISTS feed.entries (
  viewer_id       UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  post_id         UUID         NOT NULL REFERENCES content.posts(id) ON DELETE CASCADE,
  author_id       UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  reason          TEXT         NOT NULL CHECK (reason IN ('following','recommended','community','sponsored')),
  score           REAL         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (viewer_id, post_id)
);
CREATE INDEX IF NOT EXISTS feed_entries_viewer_score_idx
  ON feed.entries (viewer_id, score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS feed_entries_viewer_recency_idx
  ON feed.entries (viewer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feed_entries_author_idx
  ON feed.entries (author_id, created_at DESC);

-- =====================================================================
-- feed.user_signals — durable seed for the ranker.
-- =====================================================================
CREATE TABLE IF NOT EXISTS feed.user_signals (
  user_id         UUID         PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  interests       TEXT[]       NOT NULL DEFAULT '{}',
  blocked_tags    TEXT[]       NOT NULL DEFAULT '{}',
  short_term_vec  REAL[]       NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMIT;
