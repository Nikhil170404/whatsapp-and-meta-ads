-- =============================================================================
-- ReplyKaro — Master Schema
-- Safe to run multiple times on any Supabase project.
-- All statements use IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. WHATSAPP TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_connections (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  phone_number_id   TEXT        NOT NULL,
  waba_id           TEXT        NOT NULL,
  phone_number      TEXT        NOT NULL,
  display_name      TEXT,
  access_token      TEXT        NOT NULL,
  token_expires_at  TIMESTAMPTZ,
  webhook_verified  BOOLEAN     DEFAULT false,
  billing_type      TEXT        DEFAULT 'direct',
  status            TEXT        DEFAULT 'active',
  last_error        TEXT,
  last_error_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS token_expires_at  TIMESTAMPTZ;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS billing_type      TEXT        DEFAULT 'direct';
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS last_error        TEXT;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS last_error_at     TIMESTAMPTZ;

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_automations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  trigger_keyword  TEXT,
  trigger_type     TEXT        DEFAULT 'keyword',
  reply_message    TEXT        NOT NULL,
  is_active        BOOLEAN     DEFAULT true,
  sent_count       INTEGER     DEFAULT 0,
  last_fired_at    TIMESTAMPTZ,
  last_error       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS last_fired_at TIMESTAMPTZ;
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS last_error    TEXT;

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES users(id) ON DELETE CASCADE,
  wa_message_id  TEXT        UNIQUE,
  from_phone     TEXT        NOT NULL,
  to_phone       TEXT        NOT NULL,
  direction      TEXT        NOT NULL,
  message_type   TEXT        DEFAULT 'text',
  content        TEXT,
  status         TEXT        DEFAULT 'delivered',
  timestamp      TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS wa_contacts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES users(id) ON DELETE CASCADE,
  phone_number    TEXT        NOT NULL,
  display_name    TEXT,
  labels          TEXT[]      DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  message_count   INTEGER     DEFAULT 0,
  is_opted_in     BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phone_number)
);

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_broadcasts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  template_id      UUID        REFERENCES wa_templates(id),
  status           TEXT        DEFAULT 'draft',
  total_recipients INTEGER     DEFAULT 0,
  sent_count       INTEGER     DEFAULT 0,
  delivered_count  INTEGER     DEFAULT 0,
  read_count       INTEGER     DEFAULT 0,
  failed_count     INTEGER     DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wa_broadcasts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_broadcast_recipients (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID        REFERENCES wa_broadcasts(id) ON DELETE CASCADE,
  contact_id   UUID        REFERENCES wa_contacts(id)   ON DELETE CASCADE,
  status       TEXT        DEFAULT 'pending',
  wa_message_id TEXT,
  sent_at      TIMESTAMPTZ,
  error        TEXT
);

ALTER TABLE wa_broadcast_recipients ADD COLUMN IF NOT EXISTS error TEXT;

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_usage (
  id                             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                        UUID        REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  messages_sent_month            INTEGER     DEFAULT 0,
  automations_triggered_month    INTEGER     DEFAULT 0,
  broadcasts_sent_month          INTEGER     DEFAULT 0,
  billing_cycle_start            TIMESTAMPTZ DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. WALLET & BILLING TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_wallet (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  balance_paise         INTEGER     DEFAULT 0,
  total_topped_up_paise INTEGER     DEFAULT 0,
  total_spent_paise     INTEGER     DEFAULT 0,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------

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
-- 3. META ADS TABLES
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
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES users(id) ON DELETE CASCADE,
  campaign_id     TEXT        NOT NULL,
  name            TEXT,
  status          TEXT,
  objective       TEXT,
  daily_budget    BIGINT,
  lifetime_budget BIGINT,
  impressions     BIGINT      DEFAULT 0,
  clicks          BIGINT      DEFAULT 0,
  spend           NUMERIC(10,2) DEFAULT 0,
  ctr             NUMERIC(6,4)  DEFAULT 0,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
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

CREATE TABLE IF NOT EXISTS product_waitlist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product    TEXT        NOT NULL,
  email      TEXT,
  phone      TEXT,
  name       TEXT,
  signup_ip  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. FUNCTIONS
-- ---------------------------------------------------------------------------

-- Upsert a WhatsApp contact and bump message count
CREATE OR REPLACE FUNCTION upsert_wa_contact(
  p_user_id UUID,
  p_phone   TEXT,
  p_name    TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO wa_contacts (user_id, phone_number, display_name, last_message_at, message_count)
  VALUES (p_user_id, p_phone, p_name, NOW(), 1)
  ON CONFLICT (user_id, phone_number)
  DO UPDATE SET
    last_message_at = NOW(),
    message_count   = wa_contacts.message_count + 1,
    display_name    = COALESCE(EXCLUDED.display_name, wa_contacts.display_name);
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------

-- Atomic wallet deduction — uses FOR UPDATE row lock to prevent race conditions.
-- Raises INSUFFICIENT_BALANCE if funds are too low; WALLET_NOT_FOUND if no row exists.
-- Returns the new balance in paise.
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
    balance_paise       = v_new_balance,
    total_spent_paise   = total_spent_paise + p_amount,
    updated_at          = NOW()
  WHERE user_id = p_user_id;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

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
ALTER TABLE ad_connections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_automations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_leads                ENABLE ROW LEVEL SECURITY;
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
DROP POLICY IF EXISTS "Service role full access" ON ad_connections;
DROP POLICY IF EXISTS "Service role full access" ON ad_campaigns;
DROP POLICY IF EXISTS "Service role full access" ON ad_automations;
DROP POLICY IF EXISTS "Service role full access" ON ad_leads;
DROP POLICY IF EXISTS "Service role full access" ON product_waitlist;

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
CREATE POLICY "Service role full access" ON ad_connections          FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON ad_campaigns            FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON ad_automations          FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON ad_leads                FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON product_waitlist        FOR ALL TO service_role USING (true);

-- ---------------------------------------------------------------------------
-- 6. SCHEMA CACHE RELOAD (tells PostgREST to pick up new columns immediately)
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
