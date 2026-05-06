-- =====================================================================
-- Migration 0003: Monetization — wallet, payments, subscriptions, tips,
-- ads, and the double-entry ledger.
--
-- Owner planes: economy (wallet, payments, subs, tips, ads, ledger),
-- platform (analytics events).
-- Idempotent. Safe to re-run.
--
-- Money rules (non-negotiable):
--   * All amounts are integer minor units (paise / cents). NEVER float.
--   * `currency` is text(3) ISO-4217 — keep at INR/USD/EUR for now.
--   * Every mutation flows through the ledger; no balance is authoritative
--     except as derived from the ledger via projections (`wallet.accounts`).
--   * Idempotency: external mutations (`payments.intents`, `tips.tips`,
--     subscription renewals) require a unique `idempotency_key` per actor.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS wallet;
CREATE SCHEMA IF NOT EXISTS payments;
CREATE SCHEMA IF NOT EXISTS subscriptions;
CREATE SCHEMA IF NOT EXISTS tips;
CREATE SCHEMA IF NOT EXISTS ads;
CREATE SCHEMA IF NOT EXISTS ledger;
CREATE SCHEMA IF NOT EXISTS analytics;

-- =====================================================================
-- ledger — the source of truth for all money. Double-entry, immutable
-- once posted. Mirrors the in-memory `Ledger` class in services/ledger.
-- =====================================================================
CREATE TABLE IF NOT EXISTS ledger.accounts (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable, human-readable code: 'user_wallet:<uuid>', 'platform_revenue', ...
  code          TEXT         NOT NULL UNIQUE,
  type          TEXT         NOT NULL
                CHECK (type IN ('asset','liability','equity','revenue','expense','user_wallet')),
  currency      CHAR(3)      NOT NULL CHECK (currency IN ('INR','USD','EUR')),
  -- Optional pointer back to the user (only for `user_wallet` accounts).
  user_id       UUID         REFERENCES identity.users(id) ON DELETE RESTRICT,
  metadata      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ledger_accounts_user_idx ON ledger.accounts(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ledger.journal_entries (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  description   TEXT         NOT NULL,
  currency      CHAR(3)      NOT NULL,
  -- The external, idempotent reference for this entry (e.g. payment intent id).
  reference     TEXT         UNIQUE,
  posted_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  posted_by     TEXT         NOT NULL                       -- service name / 'system'
);
CREATE INDEX IF NOT EXISTS journal_entries_posted_idx
  ON ledger.journal_entries (posted_at DESC);

CREATE TABLE IF NOT EXISTS ledger.journal_lines (
  id            BIGSERIAL    PRIMARY KEY,
  entry_id      UUID         NOT NULL REFERENCES ledger.journal_entries(id) ON DELETE RESTRICT,
  account_id    UUID         NOT NULL REFERENCES ledger.accounts(id) ON DELETE RESTRICT,
  -- Positive = debit, negative = credit. Integer minor units.
  amount        BIGINT       NOT NULL,
  memo          TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journal_lines_account_idx
  ON ledger.journal_lines (account_id, entry_id);
CREATE INDEX IF NOT EXISTS journal_lines_entry_idx
  ON ledger.journal_lines (entry_id);

-- Invariant: every journal entry must balance to zero. Enforced by a
-- DEFERRABLE constraint trigger so multi-line inserts in one transaction
-- pass while half-built entries still get rejected at COMMIT.
CREATE OR REPLACE FUNCTION ledger.fn_assert_entry_balanced() RETURNS TRIGGER AS $$
DECLARE
  v_sum BIGINT;
  v_curr CHAR(3);
  v_entry_curr CHAR(3);
  v_entry_id UUID;
BEGIN
  v_entry_id := COALESCE(NEW.entry_id, OLD.entry_id);
  SELECT currency INTO v_entry_curr FROM ledger.journal_entries WHERE id = v_entry_id;
  IF v_entry_curr IS NULL THEN
    RAISE EXCEPTION 'journal entry % not found', v_entry_id;
  END IF;
  -- All lines must match the entry currency
  PERFORM 1
    FROM ledger.journal_lines jl
    JOIN ledger.accounts a ON a.id = jl.account_id
    WHERE jl.entry_id = v_entry_id AND a.currency <> v_entry_curr
    LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'journal entry % has line in wrong currency', v_entry_id;
  END IF;
  -- Sum to zero
  SELECT COALESCE(SUM(amount), 0) INTO v_sum
    FROM ledger.journal_lines WHERE entry_id = v_entry_id;
  IF v_sum <> 0 THEN
    RAISE EXCEPTION 'journal entry % does not balance (sum=%)', v_entry_id, v_sum;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_journal_entry_balanced'
  ) THEN
    EXECUTE $cmd$
      CREATE CONSTRAINT TRIGGER trg_journal_entry_balanced
      AFTER INSERT OR UPDATE OR DELETE ON ledger.journal_lines
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION ledger.fn_assert_entry_balanced()
    $cmd$;
  END IF;
END$$;

-- =====================================================================
-- wallet.accounts — read projection of user balances, derived from the
-- ledger by a streaming consumer. NEVER write to this directly outside
-- the projection worker; callers should query the ledger.
-- =====================================================================
CREATE TABLE IF NOT EXISTS wallet.accounts (
  user_id       UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  currency      CHAR(3)      NOT NULL CHECK (currency IN ('INR','USD','EUR')),
  balance       BIGINT       NOT NULL DEFAULT 0,
  pending_in    BIGINT       NOT NULL DEFAULT 0,
  pending_out   BIGINT       NOT NULL DEFAULT 0,
  -- Last ledger entry id reflected here, so the projection is resumable.
  last_entry_id UUID,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, currency)
);

-- =====================================================================
-- payments.intents — every charge starts here. The PSP webhook only ever
-- *transitions* an existing intent; it cannot create one out of thin air.
-- =====================================================================
CREATE TABLE IF NOT EXISTS payments.intents (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
  amount          BIGINT       NOT NULL CHECK (amount > 0),
  currency        CHAR(3)      NOT NULL,
  purpose         TEXT         NOT NULL CHECK (purpose IN ('topup','tip','subscription','ads','refund')),
  -- Idempotency: same (user_id, idempotency_key) returns the existing intent.
  idempotency_key TEXT         NOT NULL,
  -- PSP linkage.
  psp             TEXT         NOT NULL,                       -- 'razorpay', 'stripe', ...
  psp_intent_id   TEXT,
  status          TEXT         NOT NULL DEFAULT 'requires_action'
                  CHECK (status IN ('requires_action','processing','succeeded','failed','cancelled','refunded')),
  failure_reason  TEXT,
  metadata        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  succeeded_at    TIMESTAMPTZ,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS payments_intents_status_idx
  ON payments.intents (status, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_intents_user_idx
  ON payments.intents (user_id, created_at DESC);

-- =====================================================================
-- subscriptions.plans + subscriptions
-- =====================================================================
CREATE TABLE IF NOT EXISTS subscriptions.plans (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  slug          TEXT         NOT NULL,
  amount        BIGINT       NOT NULL CHECK (amount > 0),
  currency      CHAR(3)      NOT NULL,
  interval      TEXT         NOT NULL CHECK (interval IN ('monthly','quarterly','yearly')),
  -- Optional perks JSON: { "tier": "gold", "benefits": [...] }
  perks         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (creator_id, slug)
);

CREATE TABLE IF NOT EXISTS subscriptions.subscriptions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id   UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  plan_id         UUID         NOT NULL REFERENCES subscriptions.plans(id) ON DELETE RESTRICT,
  status          TEXT         NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','cancelled','past_due','expired')),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  cancelled_at    TIMESTAMPTZ,
  UNIQUE (subscriber_id, plan_id)
);
CREATE INDEX IF NOT EXISTS subscriptions_renewal_idx
  ON subscriptions.subscriptions (current_period_end)
  WHERE status = 'active';

-- =====================================================================
-- tips.tips — one-shot creator tips, settled via the ledger.
-- =====================================================================
CREATE TABLE IF NOT EXISTS tips.tips (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID         NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
  recipient_id    UUID         NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
  post_id         UUID         REFERENCES content.posts(id) ON DELETE SET NULL,
  amount          BIGINT       NOT NULL CHECK (amount > 0),
  currency        CHAR(3)      NOT NULL,
  message         TEXT,
  intent_id       UUID         REFERENCES payments.intents(id) ON DELETE SET NULL,
  ledger_entry_id UUID         REFERENCES ledger.journal_entries(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS tips_recipient_idx
  ON tips.tips (recipient_id, created_at DESC);

-- =====================================================================
-- ads.campaigns + creatives + impression counters (rollups).
-- =====================================================================
CREATE TABLE IF NOT EXISTS ads.campaigns (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id   UUID         NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  name            TEXT         NOT NULL,
  daily_budget    BIGINT       NOT NULL CHECK (daily_budget > 0),
  currency        CHAR(3)      NOT NULL,
  status          TEXT         NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','active','paused','ended','rejected')),
  -- Targeting JSON: { "topics": ["ai"], "geos": ["IN","US"], "ageRange": [18,65] }
  targeting       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ads.creatives (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID         NOT NULL REFERENCES ads.campaigns(id) ON DELETE CASCADE,
  -- Reuses the post pipeline, treating an ad creative as a flagged post.
  post_id         UUID         REFERENCES content.posts(id) ON DELETE SET NULL,
  cta_url         TEXT,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Rollup of (campaign, day) — written by a streaming aggregator. The raw
-- impression event log lives in `analytics.events_*`.
CREATE TABLE IF NOT EXISTS ads.daily_metrics (
  campaign_id     UUID         NOT NULL REFERENCES ads.campaigns(id) ON DELETE CASCADE,
  day             DATE         NOT NULL,
  impressions     BIGINT       NOT NULL DEFAULT 0,
  clicks          BIGINT       NOT NULL DEFAULT 0,
  spend           BIGINT       NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, day)
);

-- =====================================================================
-- analytics.events — raw event log, partitioned by month.
-- The hottest write path in the system; kept narrow on purpose.
-- =====================================================================
CREATE TABLE IF NOT EXISTS analytics.events (
  id            UUID         NOT NULL DEFAULT gen_random_uuid(),
  occurred_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  user_id       UUID,                                          -- nullable for anonymous
  session_id    UUID,
  kind          TEXT         NOT NULL,                         -- 'impression', 'click', 'tip.send', ...
  -- Subject (post / campaign / etc). Polymorphic by `kind`.
  subject_kind  TEXT,
  subject_id    TEXT,
  -- Bounded JSON. Reject blobs > 4 KiB at the API layer.
  attrs         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

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
    part_name  := format('events_%s', to_char(range_from, 'YYYYMM'));
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS analytics.%I PARTITION OF analytics.events
         FOR VALUES FROM (%L) TO (%L)',
       part_name, range_from, range_to
    );
  END LOOP;
END$$;

CREATE INDEX IF NOT EXISTS events_user_kind_idx
  ON analytics.events (user_id, kind, occurred_at DESC);
CREATE INDEX IF NOT EXISTS events_kind_subject_idx
  ON analytics.events (kind, subject_id, occurred_at DESC);

COMMIT;
