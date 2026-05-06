-- =====================================================================
-- Migration 0004: Platform — communities, groups, comments, mini-apps,
-- bots, knowledge graph, search documents, feature flags, experiments,
-- i18n translations.
--
-- Owner planes: social (communities, groups), content (comments,
-- search), platform (mini-apps, bots, flags, experiments, i18n,
-- knowledge graph).
-- Idempotent. Safe to re-run.
--
-- Note on `comments`: this is a separate Phase-2 service from the
-- inline `content.comments` introduced in 0001. The 0001 table targets
-- threaded post comments; this migration leaves it as the source of
-- truth and only adds *non-overlapping* tables here.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE SCHEMA IF NOT EXISTS social;
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS kg;
CREATE SCHEMA IF NOT EXISTS search;
CREATE SCHEMA IF NOT EXISTS i18n;

-- =====================================================================
-- Communities
-- =====================================================================
CREATE TABLE IF NOT EXISTS social.communities (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          CITEXT       NOT NULL UNIQUE,
  name          TEXT         NOT NULL,
  description   TEXT,
  visibility    TEXT         NOT NULL DEFAULT 'public'
                CHECK (visibility IN ('public','private')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  archived_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS social.community_memberships (
  community_id  UUID         NOT NULL REFERENCES social.communities(id) ON DELETE CASCADE,
  user_id       UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  role          TEXT         NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner','admin','moderator','member')),
  joined_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  banned_at     TIMESTAMPTZ,
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX IF NOT EXISTS community_memberships_user_idx
  ON social.community_memberships (user_id);

-- =====================================================================
-- Groups (small, friend-circle style — distinct from communities)
-- =====================================================================
CREATE TABLE IF NOT EXISTS social.groups (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT         NOT NULL,
  created_by    UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social.group_members (
  group_id      UUID         NOT NULL REFERENCES social.groups(id) ON DELETE CASCADE,
  user_id       UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  joined_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- =====================================================================
-- Mini-apps + bots (Phase 4)
-- =====================================================================
CREATE TABLE IF NOT EXISTS platform.mini_apps (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          CITEXT       NOT NULL UNIQUE,
  name          TEXT         NOT NULL,
  vendor_id     UUID         NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
  -- Capability strings exactly match the runtime allowlist
  -- (services/mini-app-runtime/src/routes.ts: ALLOWED_CAPS).
  capabilities  TEXT[]       NOT NULL DEFAULT '{}',
  status        TEXT         NOT NULL DEFAULT 'pending_review'
                CHECK (status IN ('pending_review','approved','suspended','deleted')),
  -- Sandbox policy: CSP + permitted-domains, evaluated by the gateway.
  sandbox_policy JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  approved_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS platform.mini_app_installs (
  app_id        UUID         NOT NULL REFERENCES platform.mini_apps(id) ON DELETE CASCADE,
  user_id       UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  -- User-granted capabilities (may be a subset of app.capabilities).
  granted_capabilities TEXT[] NOT NULL DEFAULT '{}',
  installed_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  uninstalled_at TIMESTAMPTZ,
  PRIMARY KEY (app_id, user_id)
);

CREATE TABLE IF NOT EXISTS platform.bots (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  handle        CITEXT       NOT NULL UNIQUE,
  owner_id      UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  -- HTTPS-only webhooks enforced at the API layer
  -- (services/bot-platform/src/routes.ts).
  webhook_url   TEXT         NOT NULL CHECK (webhook_url LIKE 'https://%'),
  -- HMAC secret used to sign webhook deliveries.
  signing_secret_hash BYTEA  NOT NULL,
  status        TEXT         NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','paused','revoked')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bots_owner_idx ON platform.bots(owner_id);

-- =====================================================================
-- Feature flags + experiments
-- =====================================================================
CREATE TABLE IF NOT EXISTS platform.feature_flags (
  key           TEXT         PRIMARY KEY,
  description   TEXT,
  enabled       BOOLEAN      NOT NULL DEFAULT FALSE,
  -- Rollout strategy. Examples:
  --   { "kind": "percent", "percent": 10 }
  --   { "kind": "user_list", "user_ids": [...] }
  --   { "kind": "country", "countries": ["IN","US"] }
  rollout       JSONB        NOT NULL DEFAULT '{"kind":"percent","percent":0}'::jsonb,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by    UUID
);

CREATE TABLE IF NOT EXISTS platform.experiments (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT         NOT NULL UNIQUE,
  description   TEXT,
  variants      JSONB        NOT NULL,                         -- e.g. ["control","ranker_v2"]
  status        TEXT         NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','running','paused','concluded')),
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  -- Holdout in [0, 1]. Users in the holdout never see any variant.
  holdout       NUMERIC(5,4) NOT NULL DEFAULT 0.0
                CHECK (holdout >= 0.0 AND holdout <= 1.0)
);

CREATE TABLE IF NOT EXISTS platform.experiment_assignments (
  experiment_id UUID         NOT NULL REFERENCES platform.experiments(id) ON DELETE CASCADE,
  user_id       UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  variant       TEXT         NOT NULL,
  assigned_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (experiment_id, user_id)
);

-- =====================================================================
-- Knowledge graph
-- =====================================================================
CREATE TABLE IF NOT EXISTS kg.entities (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT         NOT NULL,                         -- 'person','place','topic','event'
  name          TEXT         NOT NULL,
  attrs         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (type, name)
);
CREATE INDEX IF NOT EXISTS kg_entities_type_idx ON kg.entities(type);

CREATE TABLE IF NOT EXISTS kg.edges (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id       UUID         NOT NULL REFERENCES kg.entities(id) ON DELETE CASCADE,
  to_id         UUID         NOT NULL REFERENCES kg.entities(id) ON DELETE CASCADE,
  rel           TEXT         NOT NULL,
  weight        REAL         NOT NULL DEFAULT 1.0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (from_id <> to_id),
  UNIQUE (from_id, to_id, rel)
);
CREATE INDEX IF NOT EXISTS kg_edges_from_rel_idx ON kg.edges(from_id, rel);
CREATE INDEX IF NOT EXISTS kg_edges_to_rel_idx   ON kg.edges(to_id, rel);

-- =====================================================================
-- Search documents — full-text fallback. Production runs OpenSearch but
-- this table lets ops queries use Postgres only when the cluster is down.
-- =====================================================================
CREATE TABLE IF NOT EXISTS search.documents (
  id            TEXT         PRIMARY KEY,                      -- "post:<uuid>", "user:<uuid>"
  kind          TEXT         NOT NULL,                         -- 'post','user','community','mini_app'
  title         TEXT,
  body          TEXT,
  language      TEXT,
  tags          TEXT[]       NOT NULL DEFAULT '{}',
  search_vec    TSVECTOR     NOT NULL,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_documents_vec_gin
  ON search.documents USING GIN (search_vec);
CREATE INDEX IF NOT EXISTS search_documents_kind_idx
  ON search.documents (kind);

-- =====================================================================
-- i18n.translations — per-key, per-locale machine + human translations.
-- Empty by default; @ather/i18n bundles canonical English at build time.
-- =====================================================================
CREATE TABLE IF NOT EXISTS i18n.translations (
  key           TEXT         NOT NULL,
  locale        TEXT         NOT NULL,                         -- 'en','hi','ta',...
  value         TEXT         NOT NULL,
  source        TEXT         NOT NULL DEFAULT 'human'
                CHECK (source IN ('human','machine','community')),
  approved      BOOLEAN      NOT NULL DEFAULT FALSE,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (key, locale)
);
CREATE INDEX IF NOT EXISTS translations_locale_idx ON i18n.translations(locale);

COMMIT;
