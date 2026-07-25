-- =============================================================================
-- ReplyKaro — Consolidated Master Migration
-- Run this ONE file on any fresh or existing Supabase project.
-- Every statement is idempotent: safe to run multiple times.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — TABLES (dependency order)
-- =============================================================================

-- Users table is created by Supabase Auth or your own auth setup.
-- All other tables reference it. Make sure it has a plan_type column:
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_type         TEXT        DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_user_id  TEXT;
CREATE INDEX IF NOT EXISTS users_facebook_user_id_idx ON users(facebook_user_id);

-- ---------------------------------------------------------------------------
-- WhatsApp connection per user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wa_connections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  phone_number_id  TEXT        NOT NULL,
  waba_id          TEXT        NOT NULL,
  phone_number     TEXT        NOT NULL,
  display_name     TEXT,
  access_token     TEXT        NOT NULL,
  token_expires_at TIMESTAMPTZ,
  webhook_verified BOOLEAN     DEFAULT false,
  billing_type     TEXT        DEFAULT 'direct',
  status           TEXT        DEFAULT 'active',
  last_error       TEXT,
  last_error_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS token_expires_at          TIMESTAMPTZ;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS billing_type              TEXT        DEFAULT 'direct';
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS last_error                TEXT;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS last_error_at             TIMESTAMPTZ;
-- Meta quality & tier compliance
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS quality_rating            TEXT        DEFAULT 'UNKNOWN';
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS messaging_tier            INTEGER     DEFAULT 1;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS quality_paused_at         TIMESTAMPTZ;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS quality_synced_at         TIMESTAMPTZ;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS daily_unique_sent         INTEGER     DEFAULT 0;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS daily_sent_reset_at       TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS token_refresh_failed_at   TIMESTAMPTZ;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS token_warning_sent_at     TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Keyword / event automations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wa_automations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  trigger_keyword TEXT,
  trigger_type    TEXT        DEFAULT 'keyword',
  reply_message   TEXT        NOT NULL,
  is_active       BOOLEAN     DEFAULT true,
  sent_count      INTEGER     DEFAULT 0,
  last_fired_at   TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS last_fired_at   TIMESTAMPTZ;
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS last_error      TEXT;
-- Interactive & media message support
-- message_type: 'text' | 'image' | 'video' | 'document' | 'buttons'
-- media_url:    public HTTPS URL for image / video / document
-- button_options: { "buttons": [{"id":"...","title":"..."}] }
--                 { "filename": "invoice.pdf" } for document type
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS message_type    TEXT        DEFAULT 'text';
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS media_url       TEXT;
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS button_options  JSONB;

-- ---------------------------------------------------------------------------
-- Inbound + outbound messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wa_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES users(id) ON DELETE CASCADE,
  message_id   TEXT        UNIQUE,
  wa_message_id TEXT,
  from_phone   TEXT,
  to_phone     TEXT        NOT NULL,
  direction    TEXT        NOT NULL,
  message_type TEXT        DEFAULT 'text',
  content      TEXT,
  status       TEXT        DEFAULT 'delivered',
  timestamp    TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- from_phone is NULL for outbound messages — must not be NOT NULL
ALTER TABLE wa_messages ALTER COLUMN from_phone DROP NOT NULL;
ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS message_id    TEXT;
ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS wa_message_id TEXT;
ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS error_code    INTEGER;
ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS error_message TEXT;

-- ---------------------------------------------------------------------------
-- WhatsApp templates (submitted to Meta for approval)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wa_templates (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  language         TEXT        DEFAULT 'en_US',
  category         TEXT        DEFAULT 'UTILITY',
  body_text        TEXT        NOT NULL,
  status           TEXT        DEFAULT 'pending',
  meta_template_id TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS meta_template_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wa_templates_user_id_name_key'
  ) THEN
    ALTER TABLE wa_templates ADD CONSTRAINT wa_templates_user_id_name_key UNIQUE (user_id, name);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Contacts (auto-created when someone messages you)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wa_contacts (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID        REFERENCES users(id) ON DELETE CASCADE,
  phone_number              TEXT        NOT NULL,
  display_name              TEXT,
  labels                    TEXT[]      DEFAULT '{}',
  last_message_at           TIMESTAMPTZ,
  message_count             INTEGER     DEFAULT 0,
  is_opted_in               BOOLEAN     DEFAULT true,
  opted_in_at               TIMESTAMPTZ,
  opted_out_at              TIMESTAMPTZ,
  last_customer_message_at  TIMESTAMPTZ,
  ctwa_window_expires_at    TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phone_number)
);

ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS opted_in_at                TIMESTAMPTZ;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS opted_out_at               TIMESTAMPTZ;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS last_customer_message_at   TIMESTAMPTZ;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS ctwa_window_expires_at     TIMESTAMPTZ;

-- Backfill opted_in_at for contacts that were created before this column existed
UPDATE wa_contacts SET opted_in_at = created_at WHERE opted_in_at IS NULL AND is_opted_in = true;

-- ---------------------------------------------------------------------------
-- Broadcasts (bulk sends to multiple contacts using a template)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wa_broadcasts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  template_id      UUID        REFERENCES wa_templates(id),
  status           TEXT        DEFAULT 'draft',
  scheduled_at     TIMESTAMPTZ,
  total_recipients INTEGER     DEFAULT 0,
  sent_count       INTEGER     DEFAULT 0,
  delivered_count  INTEGER     DEFAULT 0,
  read_count       INTEGER     DEFAULT 0,
  failed_count     INTEGER     DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wa_broadcasts ADD COLUMN IF NOT EXISTS scheduled_at  TIMESTAMPTZ;
ALTER TABLE wa_broadcasts ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

-- ---------------------------------------------------------------------------
-- Broadcast recipient rows (one per contact per broadcast)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wa_broadcast_recipients (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id  UUID        REFERENCES wa_broadcasts(id) ON DELETE CASCADE,
  contact_id    UUID        REFERENCES wa_contacts(id)   ON DELETE CASCADE,
  status        TEXT        DEFAULT 'pending',
  wa_message_id TEXT,
  sent_at       TIMESTAMPTZ,
  error         TEXT
);

ALTER TABLE wa_broadcast_recipients ADD COLUMN IF NOT EXISTS error TEXT;

-- ---------------------------------------------------------------------------
-- Monthly usage counters per user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wa_usage (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      UUID        REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  messages_sent_month          INTEGER     DEFAULT 0,
  automations_triggered_month  INTEGER     DEFAULT 0,
  broadcasts_sent_month        INTEGER     DEFAULT 0,
  billing_cycle_start          TIMESTAMPTZ DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Wallet (managed-billing users pay per message from prepaid balance)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wa_wallet (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  balance_paise         INTEGER     DEFAULT 0,
  total_topped_up_paise INTEGER     DEFAULT 0,
  total_spent_paise     INTEGER     DEFAULT 0,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_wallet_transactions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        REFERENCES users(id) ON DELETE CASCADE,
  type                 TEXT        NOT NULL,
  amount_paise         INTEGER     NOT NULL,
  balance_after_paise  INTEGER     NOT NULL,
  description          TEXT,
  razorpay_order_id    TEXT,
  razorpay_payment_id  TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wa_wallet_transactions ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wa_wallet_transactions_razorpay_payment_id_key'
  ) THEN
    ALTER TABLE wa_wallet_transactions
      ADD CONSTRAINT wa_wallet_transactions_razorpay_payment_id_key
      UNIQUE (razorpay_payment_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- REST API keys (for website / third-party integration)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key      TEXT        NOT NULL UNIQUE DEFAULT ('rk_live_' || replace(gen_random_uuid()::text, '-', '')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wa_api_keys_key_idx ON public.wa_api_keys(api_key);

-- ---------------------------------------------------------------------------
-- Meta Ads tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_connections (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  fb_user_id        TEXT        NOT NULL,
  ad_account_id     TEXT        NOT NULL,
  page_id           TEXT,
  page_access_token TEXT,
  ig_user_id        TEXT,
  access_token      TEXT        NOT NULL,
  token_expires_at  TIMESTAMPTZ,
  status            TEXT        DEFAULT 'active',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ad_connections ADD COLUMN IF NOT EXISTS page_access_token TEXT;
ALTER TABLE ad_connections ADD COLUMN IF NOT EXISTS ig_user_id        TEXT;

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          REFERENCES users(id) ON DELETE CASCADE,
  campaign_id     TEXT          NOT NULL,
  name            TEXT,
  status          TEXT,
  objective       TEXT,
  daily_budget    BIGINT,
  lifetime_budget BIGINT,
  impressions     BIGINT        DEFAULT 0,
  clicks          BIGINT        DEFAULT 0,
  spend           NUMERIC(10,2) DEFAULT 0,
  ctr             NUMERIC(6,4)  DEFAULT 0,
  synced_at       TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(user_id, campaign_id)
);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_automations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES users(id) ON DELETE CASCADE,
  campaign_id     TEXT,
  ad_id           TEXT,
  trigger_keyword TEXT,
  reply_message   TEXT        NOT NULL,
  send_dm         BOOLEAN     DEFAULT true,
  is_active       BOOLEAN     DEFAULT true,
  sent_count      INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_leads (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES users(id) ON DELETE CASCADE,
  page_id        TEXT,
  lead_id        TEXT        UNIQUE,
  name           TEXT,
  email          TEXT,
  phone          TEXT,
  raw_data       JSONB,
  whatsapp_sent  BOOLEAN     DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Click-to-WhatsApp campaigns created via ReplyKaro
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ctwa_campaigns (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID          REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT          NOT NULL,
  ad_text          TEXT          NOT NULL,
  headline         TEXT          NOT NULL,
  whatsapp_number  TEXT          NOT NULL,
  opening_message  TEXT,
  daily_budget_inr NUMERIC(10,2) NOT NULL,
  target_countries TEXT[]        DEFAULT '{IN}',
  meta_campaign_id TEXT,
  meta_adset_id    TEXT,
  meta_creative_id TEXT,
  meta_ad_id       TEXT,
  status           TEXT          DEFAULT 'paused',
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Product waitlist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_waitlist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product    TEXT        NOT NULL,
  email      TEXT,
  phone      TEXT,
  name       TEXT,
  signup_ip  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =============================================================================
-- SECTION 2 — INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS wa_contacts_opted_in_idx
  ON wa_contacts(user_id, is_opted_in) WHERE is_opted_in = true;


-- =============================================================================
-- SECTION 3 — FUNCTIONS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Upsert a contact and record opt-in on first inbound message
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_wa_contact(
  p_user_id UUID,
  p_phone   TEXT,
  p_name    TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO wa_contacts (
    user_id, phone_number, display_name,
    last_message_at, message_count, is_opted_in, opted_in_at
  )
  VALUES (p_user_id, p_phone, p_name, NOW(), 1, true, NOW())
  ON CONFLICT (user_id, phone_number)
  DO UPDATE SET
    last_message_at = NOW(),
    message_count   = wa_contacts.message_count + 1,
    display_name    = COALESCE(EXCLUDED.display_name, wa_contacts.display_name),
    opted_in_at     = COALESCE(wa_contacts.opted_in_at, NOW());
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Atomic wallet deduction — FOR UPDATE row lock prevents race conditions.
-- Raises INSUFFICIENT_BALANCE or WALLET_NOT_FOUND; returns new balance in paise.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deduct_wallet_balance(
  p_user_id UUID,
  p_amount  INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_balance     INTEGER;
  v_new_balance INTEGER;
BEGIN
  SELECT balance_paise INTO v_balance
  FROM wa_wallet
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: % < %', v_balance, p_amount;
  END IF;

  v_new_balance := v_balance - p_amount;

  UPDATE wa_wallet
  SET
    balance_paise     = v_new_balance,
    total_spent_paise = total_spent_paise + p_amount,
    updated_at        = NOW()
  WHERE user_id = p_user_id;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Purge messages older than 90 days (Meta data-minimisation requirement)
-- Schedule via pg_cron: SELECT cron.schedule('0 3 * * *', $$SELECT purge_old_wa_messages()$$);
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_old_wa_messages() RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM wa_messages WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- SECTION 4 — ROW LEVEL SECURITY
-- All tables use service_role bypass (your Next.js backend uses the service key).
-- =============================================================================

ALTER TABLE wa_connections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_automations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_templates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_broadcasts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_usage                ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_wallet               ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_wallet_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_api_keys             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_connections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_automations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_leads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE ctwa_campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_waitlist        ENABLE ROW LEVEL SECURITY;

-- Drop before recreate so re-runs never fail on "policy already exists"
DROP POLICY IF EXISTS "Service role full access" ON wa_connections;
DROP POLICY IF EXISTS "Service role full access" ON wa_automations;
DROP POLICY IF EXISTS "Service role full access" ON wa_messages;
DROP POLICY IF EXISTS "Service role full access" ON wa_templates;
DROP POLICY IF EXISTS "Service role full access" ON wa_contacts;
DROP POLICY IF EXISTS "Service role full access" ON wa_broadcasts;
DROP POLICY IF EXISTS "Service role full access" ON wa_broadcast_recipients;
DROP POLICY IF EXISTS "Service role full access" ON wa_usage;
DROP POLICY IF EXISTS "Service role full access" ON wa_wallet;
DROP POLICY IF EXISTS "Service role full access" ON wa_wallet_transactions;
DROP POLICY IF EXISTS "Service role full access" ON wa_api_keys;
DROP POLICY IF EXISTS "Service role full access" ON ad_connections;
DROP POLICY IF EXISTS "Service role full access" ON ad_campaigns;
DROP POLICY IF EXISTS "Service role full access" ON ad_automations;
DROP POLICY IF EXISTS "Service role full access" ON ad_leads;
DROP POLICY IF EXISTS "Service role full access" ON ctwa_campaigns;
DROP POLICY IF EXISTS "Service role full access" ON product_waitlist;
DROP POLICY IF EXISTS "Users can manage their own API key" ON wa_api_keys;

CREATE POLICY "Service role full access" ON wa_connections          FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_automations          FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_messages             FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_templates            FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_contacts             FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_broadcasts           FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_broadcast_recipients FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_usage                FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_wallet               FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_wallet_transactions  FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_api_keys             FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON ad_connections          FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON ad_campaigns            FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON ad_automations          FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON ad_leads                FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON ctwa_campaigns          FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON product_waitlist        FOR ALL TO service_role USING (true);

-- Users can read their own API key via the anon/authenticated role too
CREATE POLICY "Users can manage their own API key"
  ON public.wa_api_keys FOR ALL
  USING (auth.uid() = user_id);


-- =============================================================================
-- SECTION 5 — RELOAD POSTGREST SCHEMA CACHE
-- =============================================================================
NOTIFY pgrst, 'reload schema';
