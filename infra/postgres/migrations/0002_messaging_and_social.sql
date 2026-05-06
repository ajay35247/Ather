-- =====================================================================
-- Migration 0002: Messaging, Social Blocks, Notifications, Audit Log
--
-- Owner planes: social (blocks), messaging (chat), notification, platform (audit).
-- Idempotent. Safe to re-run.
--
-- Sharding strategy:
--   * `messaging.messages` is the hottest table. At ≤1B messages a single
--     primary + read replicas works; beyond that, partition by
--     `hash(conversation_id)` (Citus or app-level) — kept the schema
--     partition-friendly (no foreign keys spanning shards).
--   * `notification.notifications` is per-user; partitionable on `user_id`.
--   * `platform.audit_log` is partitioned by month at the schema level.
--
-- Encryption note:
--   `messaging.messages.ciphertext` is exactly that — ciphertext. Plaintext
--   never touches Postgres. The server cannot decrypt; only the client
--   (Signal-style double ratchet) can.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS social;
CREATE SCHEMA IF NOT EXISTS messaging;
CREATE SCHEMA IF NOT EXISTS notification;
CREATE SCHEMA IF NOT EXISTS platform;

-- =====================================================================
-- social.blocks — when A blocks B, A's feeds/search must hide B and B's
-- writes targeting A (replies, mentions, DMs) must be rejected.
-- =====================================================================
CREATE TABLE IF NOT EXISTS social.blocks (
  blocker_id    UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  blocked_id    UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  reason        TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx
  ON social.blocks (blocked_id);

-- =====================================================================
-- messaging.conversations  + members + messages (E2EE ciphertext only)
-- =====================================================================
CREATE TABLE IF NOT EXISTS messaging.conversations (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          TEXT         NOT NULL CHECK (kind IN ('dm', 'group', 'channel')),
  title         TEXT,                                          -- NULL for DMs
  created_by    UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS conversations_kind_idx
  ON messaging.conversations (kind, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messaging.conversation_members (
  conversation_id UUID         NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
  user_id         UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  role            TEXT         NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner', 'admin', 'member')),
  -- Encrypted device key bundle for this member, as JSON (XEdDSA + X3DH).
  -- Server treats this as opaque blobs; only the client decrypts.
  identity_key    BYTEA,
  joined_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  left_at         TIMESTAMPTZ,
  last_read_at    TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS conversation_members_user_idx
  ON messaging.conversation_members (user_id, conversation_id)
  WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS messaging.messages (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID         NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
  sender_id       UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  -- Server stores ciphertext only. Max 64 KiB matches the
  -- service-kit chat schema limit (services/chat/src/routes.ts).
  ciphertext      BYTEA        NOT NULL,
  -- Optional encrypted media reference, also opaque to the server.
  media_id        UUID,
  -- For Signal-style ratchet metadata that the *client* needs.
  message_type    TEXT         NOT NULL DEFAULT 'text'
                  CHECK (message_type IN ('text', 'media', 'reaction', 'system')),
  -- Per-recipient delivery state lives in `messaging.delivery` (below).
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  edited_at       TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  CHECK (octet_length(ciphertext) <= 65536)
);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messaging.messages (conversation_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS messages_sender_idx
  ON messaging.messages (sender_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS messaging.delivery (
  message_id      UUID         NOT NULL REFERENCES messaging.messages(id) ON DELETE CASCADE,
  user_id         UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS delivery_user_undelivered_idx
  ON messaging.delivery (user_id)
  WHERE delivered_at IS NULL;

-- =====================================================================
-- notification.notifications — durable notification log.
-- Push tokens live in `notification.devices`.
-- =====================================================================
CREATE TABLE IF NOT EXISTS notification.notifications (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  kind          TEXT         NOT NULL,                         -- 'follow.new', 'post.like', 'tip.received', ...
  payload       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  read_at       TIMESTAMPTZ,
  archived_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notification.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_user_recent_idx
  ON notification.notifications (user_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS notification.devices (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  platform        TEXT         NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  push_token      TEXT         NOT NULL,
  -- Token hash for dedup without indexing the token text directly.
  push_token_hash BYTEA        NOT NULL,
  app_version     TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  UNIQUE (user_id, push_token_hash)
);
CREATE INDEX IF NOT EXISTS devices_user_active_idx
  ON notification.devices (user_id)
  WHERE revoked_at IS NULL;

-- =====================================================================
-- platform.audit_log — append-only, partitioned by month.
-- Used by security, compliance, GDPR/DPDP DSAR responses.
-- =====================================================================
CREATE TABLE IF NOT EXISTS platform.audit_log (
  id            BIGSERIAL,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id      UUID,                                          -- nullable for system events
  actor_kind    TEXT NOT NULL CHECK (actor_kind IN ('user', 'service', 'system', 'admin')),
  action        TEXT NOT NULL,                                 -- 'login', 'post.delete', 'tip.refund', ...
  target_kind   TEXT,
  target_id     TEXT,
  ip            INET,
  user_agent    TEXT,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Bootstrap the first 3 monthly partitions so the table is usable
-- immediately. A scheduled job rolls forward future partitions.
DO $$
DECLARE
  start_dt date := date_trunc('month', now())::date;
  i int;
  part_name text;
  range_from date;
  range_to date;
BEGIN
  FOR i IN 0..2 LOOP
    range_from := (start_dt + (i || ' month')::interval)::date;
    range_to   := (start_dt + ((i+1) || ' month')::interval)::date;
    part_name  := format('audit_log_%s', to_char(range_from, 'YYYYMM'));
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS platform.%I PARTITION OF platform.audit_log
         FOR VALUES FROM (%L) TO (%L)',
       part_name, range_from, range_to
    );
  END LOOP;
END$$;

CREATE INDEX IF NOT EXISTS audit_log_actor_idx
  ON platform.audit_log (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx
  ON platform.audit_log (action, occurred_at DESC);

COMMIT;
