-- =============================================================================
-- ReplyKaro: canonical database schema (WhatsApp only)
--
-- Run this ONE file in the Supabase SQL editor. It is idempotent and works on
-- both a fresh project and an existing one: tables are created if missing and
-- every column the application uses is added if missing. It replaces all files
-- that used to live in supabase/migrations/.
--
-- Access model: the app talks to Postgres only through the service-role key
-- (server side). Every table has row level security enabled with no policies,
-- so the anon and authenticated roles can read and write nothing.
--
-- Not touched on purpose: tables left over from removed features (wa_wallet,
-- wa_wallet_transactions, ad_*, ctwa_campaigns). They are harmless; see the
-- optional clean-up block at the end of this file.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. SHARED HELPERS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. ACCOUNTS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  facebook_user_id          TEXT        NOT NULL,
  display_name              TEXT,
  email                     TEXT,
  profile_picture_url       TEXT,
  fb_access_token           TEXT,
  fb_token_expires_at       TIMESTAMPTZ,
  plan_type                 TEXT        NOT NULL DEFAULT 'free',
  plan_expires_at           TIMESTAMPTZ,
  razorpay_subscription_id  TEXT,
  subscription_status       TEXT,
  subscription_interval     TEXT,
  notification_settings     JSONB,
  referral_code             TEXT,
  referred_by               TEXT,
  total_referral_earnings   NUMERIC     NOT NULL DEFAULT 0,
  payout_info               TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_user_id         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name             TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email                    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fb_access_token          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fb_token_expires_at      TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_type                TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at          TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_interval    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings    JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code            TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by              TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referral_earnings  NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_info              TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- The login flow upserts with onConflict "facebook_user_id", which requires this.
CREATE UNIQUE INDEX IF NOT EXISTS users_facebook_user_id_uidx ON users (facebook_user_id);
CREATE INDEX IF NOT EXISTS users_razorpay_subscription_idx
  ON users (razorpay_subscription_id) WHERE razorpay_subscription_id IS NOT NULL;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. WHATSAPP CONNECTION (one per account)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_connections (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone_number_id          TEXT        NOT NULL,
  waba_id                  TEXT        NOT NULL,
  phone_number             TEXT        NOT NULL,
  display_name             TEXT,
  access_token             TEXT        NOT NULL,
  token_expires_at         TIMESTAMPTZ,
  token_refresh_failed_at  TIMESTAMPTZ,
  token_warning_sent_at    TIMESTAMPTZ,
  webhook_verified         BOOLEAN     NOT NULL DEFAULT false,
  status                   TEXT        NOT NULL DEFAULT 'active',
  quality_rating           TEXT        DEFAULT 'UNKNOWN',
  messaging_tier           INTEGER     DEFAULT 1,
  quality_synced_at        TIMESTAMPTZ,
  quality_paused_at        TIMESTAMPTZ,
  daily_unique_sent        INTEGER     NOT NULL DEFAULT 0,
  daily_sent_reset_at      TIMESTAMPTZ DEFAULT NOW(),
  last_error               TEXT,
  last_error_at            TIMESTAMPTZ,
  hours_enabled            BOOLEAN     NOT NULL DEFAULT false,
  hours                    JSONB,
  hours_timezone           TEXT        NOT NULL DEFAULT 'Asia/Kolkata',
  away_message             TEXT,
  messaging_limit_tier     TEXT,
  restriction_summary      TEXT,
  restriction_blocks       BOOLEAN     NOT NULL DEFAULT false,
  restricted_until         TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS display_name             TEXT;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS token_expires_at         TIMESTAMPTZ;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS token_refresh_failed_at  TIMESTAMPTZ;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS token_warning_sent_at    TIMESTAMPTZ;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS webhook_verified         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS quality_rating           TEXT DEFAULT 'UNKNOWN';
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS messaging_tier           INTEGER DEFAULT 1;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS quality_synced_at        TIMESTAMPTZ;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS quality_paused_at        TIMESTAMPTZ;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS daily_unique_sent        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS daily_sent_reset_at      TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS last_error               TEXT;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS last_error_at            TIMESTAMPTZ;
-- Business hours and away message
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS hours_enabled            BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS hours                    JSONB;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS hours_timezone           TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS away_message             TEXT;
-- Meta's messaging limit as reported (TIER_250, TIER_2K, TIER_10K, TIER_100K, TIER_UNLIMITED...).
-- messaging_tier (an integer) is the old, mis-parsed form and is no longer used.
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS messaging_limit_tier     TEXT;
-- Policy enforcement from Meta's account_update webhook
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS restriction_summary      TEXT;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS restriction_blocks       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS restricted_until         TIMESTAMPTZ;

-- The webhook resolves the account from phone_number_id, so two accounts must
-- never share one real number. "unknown" is the placeholder used before Meta
-- reports the id. If duplicates already exist the index is skipped with a notice.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS wa_connections_phone_number_id_uidx
    ON wa_connections (phone_number_id) WHERE phone_number_id <> 'unknown';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Duplicate phone_number_id rows exist; unique index skipped. Resolve them and re-run.';
END $$;

CREATE INDEX IF NOT EXISTS wa_connections_waba_id_idx ON wa_connections (waba_id);
CREATE INDEX IF NOT EXISTS wa_connections_active_idx ON wa_connections (status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS wa_connections_token_expiry_idx
  ON wa_connections (token_expires_at) WHERE status = 'active';

DROP TRIGGER IF EXISTS wa_connections_set_updated_at ON wa_connections;
CREATE TRIGGER wa_connections_set_updated_at BEFORE UPDATE ON wa_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. AUTOMATIONS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_automations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  trigger_type     TEXT        NOT NULL DEFAULT 'keyword',
  trigger_keyword  TEXT,
  message_type     TEXT        NOT NULL DEFAULT 'text',
  reply_message    TEXT,
  media_url        TEXT,
  button_options   JSONB,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  sent_count       INTEGER     NOT NULL DEFAULT 0,
  last_fired_at    TIMESTAMPTZ,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS trigger_type   TEXT NOT NULL DEFAULT 'keyword';
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS message_type   TEXT NOT NULL DEFAULT 'text';
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS media_url      TEXT;
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS button_options JSONB;
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS last_fired_at  TIMESTAMPTZ;
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS last_error     TEXT;
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Media and button automations carry no reply text, so reply_message is optional.
ALTER TABLE wa_automations ALTER COLUMN reply_message DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wa_automations_trigger_type_check') THEN
    ALTER TABLE wa_automations ADD CONSTRAINT wa_automations_trigger_type_check
      CHECK (trigger_type IN ('keyword', 'any', 'welcome')) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS wa_automations_user_active_idx ON wa_automations (user_id, is_active);

DROP TRIGGER IF EXISTS wa_automations_set_updated_at ON wa_automations;
CREATE TRIGGER wa_automations_set_updated_at BEFORE UPDATE ON wa_automations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. MESSAGE TEMPLATES (submitted to Meta for approval)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_templates (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  language          TEXT        NOT NULL DEFAULT 'en_US',
  category          TEXT        NOT NULL DEFAULT 'UTILITY',
  body_text         TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending',
  meta_template_id  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS meta_template_id TEXT;
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS template_type     TEXT NOT NULL DEFAULT 'standard'; -- 'standard' | 'otp'
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS header_text       TEXT;
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS footer_text       TEXT;
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS buttons           JSONB;
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS examples          JSONB;
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;

-- The templates API upserts on (user_id, name).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wa_templates_user_id_name_key') THEN
    ALTER TABLE wa_templates ADD CONSTRAINT wa_templates_user_id_name_key UNIQUE (user_id, name);
  END IF;
END $$;

-- OTP templates have fixed Meta-provided text, so body_text is optional.
ALTER TABLE wa_templates ALTER COLUMN body_text DROP NOT NULL;

CREATE INDEX IF NOT EXISTS wa_templates_user_status_idx ON wa_templates (user_id, status);

-- ---------------------------------------------------------------------------
-- 5. CONTACTS AND CONSENT (DPDP Act 2023)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_contacts (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number              TEXT        NOT NULL,
  display_name              TEXT,
  labels                    TEXT[]      NOT NULL DEFAULT '{}',
  message_count             INTEGER     NOT NULL DEFAULT 0,
  last_message_at           TIMESTAMPTZ,
  last_customer_message_at  TIMESTAMPTZ,
  ctwa_window_expires_at    TIMESTAMPTZ,
  is_opted_in               BOOLEAN     NOT NULL DEFAULT true,
  opted_in_at               TIMESTAMPTZ,
  opted_out_at              TIMESTAMPTZ,
  consent_source            TEXT,
  consent_purposes          TEXT[]      DEFAULT '{}',
  consent_notice_version    TEXT,
  last_away_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, phone_number)
);

ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMPTZ;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS ctwa_window_expires_at   TIMESTAMPTZ;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS opted_in_at              TIMESTAMPTZ;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS opted_out_at             TIMESTAMPTZ;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS consent_source           TEXT;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS consent_purposes         TEXT[] DEFAULT '{}';
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS consent_notice_version   TEXT;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS last_away_at             TIMESTAMPTZ;

-- One phone format: digits only ("919876543210"), as WhatsApp reports customers.
-- Contacts added as "+91…" used to split from the same person created by an
-- incoming message ("91…"), so an opt-out could miss the contact broadcasts use.
-- Merge each pair into the digits record (an opt-out on either side wins, labels
-- are combined, marketing consent needs both), then strip the "+" from the rest.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id AS plus_id, d.id AS digit_id
    FROM wa_contacts p
    JOIN wa_contacts d ON d.user_id = p.user_id AND d.phone_number = ltrim(p.phone_number, '+')
    WHERE p.phone_number LIKE '+%'
  LOOP
    UPDATE wa_broadcast_recipients SET contact_id = r.digit_id WHERE contact_id = r.plus_id;
    UPDATE wa_consent_logs SET contact_id = r.digit_id WHERE contact_id = r.plus_id;
    UPDATE wa_contacts d SET
      labels = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(d.labels, '{}') || COALESCE(p.labels, '{}')) AS x),
      display_name = COALESCE(d.display_name, p.display_name),
      is_opted_in = d.is_opted_in AND p.is_opted_in,
      opted_out_at = CASE WHEN d.is_opted_in AND p.is_opted_in THEN d.opted_out_at
                          ELSE COALESCE(d.opted_out_at, p.opted_out_at, NOW()) END,
      consent_purposes = CASE
        WHEN COALESCE(array_length(d.consent_purposes, 1), 0) > 0 AND COALESCE(array_length(p.consent_purposes, 1), 0) > 0
          THEN ARRAY(SELECT x FROM unnest(d.consent_purposes) AS x WHERE x = ANY(p.consent_purposes))
        ELSE COALESCE(NULLIF(d.consent_purposes, '{}'), p.consent_purposes) END
    FROM wa_contacts p
    WHERE d.id = r.digit_id AND p.id = r.plus_id;
    DELETE FROM wa_contacts WHERE id = r.plus_id;
  END LOOP;

  UPDATE wa_contacts SET phone_number = ltrim(phone_number, '+') WHERE phone_number LIKE '+%';
END $$;

-- Existing opted-in contacts that messaged first are treated as opted in from creation.
UPDATE wa_contacts SET opted_in_at = created_at WHERE opted_in_at IS NULL AND is_opted_in = true;

CREATE INDEX IF NOT EXISTS wa_contacts_user_last_message_idx
  ON wa_contacts (user_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS wa_contacts_opted_in_idx
  ON wa_contacts (user_id) WHERE is_opted_in = true;
CREATE INDEX IF NOT EXISTS wa_contacts_labels_gin_idx ON wa_contacts USING GIN (labels);

-- Labels in use, for pickers. Done in SQL so it never loads every contact.
CREATE OR REPLACE FUNCTION distinct_contact_labels(p_user UUID) RETURNS TEXT[] AS $$
  SELECT COALESCE(array_agg(l ORDER BY l), '{}') FROM (
    SELECT DISTINCT unnest(labels) AS l FROM wa_contacts WHERE user_id = p_user LIMIT 200
  ) t;
$$ LANGUAGE sql STABLE;

-- Append-only proof of every consent grant and withdrawal.
CREATE TABLE IF NOT EXISTS wa_consent_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id      UUID        REFERENCES wa_contacts(id) ON DELETE SET NULL,
  phone_number    TEXT        NOT NULL,
  action          TEXT        NOT NULL CHECK (action IN ('granted', 'withdrawn')),
  purposes        TEXT[]      NOT NULL DEFAULT '{}',
  source          TEXT        NOT NULL,
  notice_version  TEXT,
  evidence        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wa_consent_logs_user_phone_idx
  ON wa_consent_logs (user_id, phone_number, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_consent_logs_contact_idx
  ON wa_consent_logs (contact_id) WHERE contact_id IS NOT NULL;

-- Rows cannot be edited. The one allowed change is ON DELETE SET NULL clearing
-- contact_id when a contact is erased, so erasure keeps working.
CREATE OR REPLACE FUNCTION wa_consent_logs_immutable() RETURNS trigger AS $$
BEGIN
  IF (to_jsonb(NEW) - 'contact_id') IS DISTINCT FROM (to_jsonb(OLD) - 'contact_id') THEN
    RAISE EXCEPTION 'wa_consent_logs is append-only';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wa_consent_logs_no_update ON wa_consent_logs;
CREATE TRIGGER wa_consent_logs_no_update BEFORE UPDATE ON wa_consent_logs
  FOR EACH ROW EXECUTE FUNCTION wa_consent_logs_immutable();

-- Backfill a "granted" record for contacts that predate consent logging.
INSERT INTO wa_consent_logs (user_id, contact_id, phone_number, action, purposes, source, evidence, created_at)
SELECT c.user_id, c.id, c.phone_number, 'granted', ARRAY['service_messages'], 'backfill',
       jsonb_build_object('note', 'Backfilled from wa_contacts.opted_in_at'),
       COALESCE(c.opted_in_at, c.created_at)
FROM wa_contacts c
WHERE c.is_opted_in = true
  AND NOT EXISTS (SELECT 1 FROM wa_consent_logs l WHERE l.contact_id = c.id);

-- Data Principal requests (access, correction, erasure, grievance) with a 30 day SLA.
CREATE TABLE IF NOT EXISTS dsr_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  requester     TEXT        NOT NULL,
  request_type  TEXT        NOT NULL CHECK (request_type IN ('access', 'correction', 'erasure', 'grievance', 'withdraw_consent')),
  details       TEXT,
  status        TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'rejected')),
  due_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dsr_requests_open_due_idx
  ON dsr_requests (due_at) WHERE status IN ('open', 'in_progress');

-- ---------------------------------------------------------------------------
-- 6. MESSAGES, CONVERSATIONS AND TEAM
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wa_message_id  TEXT,
  message_id     TEXT,
  from_phone     TEXT,
  to_phone       TEXT        NOT NULL,
  direction      TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type   TEXT        NOT NULL DEFAULT 'text',
  content        TEXT,
  status         TEXT        NOT NULL DEFAULT 'delivered',
  error_code     INTEGER,
  error_message  TEXT,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS wa_message_id TEXT;
ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS message_id    TEXT;
ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS error_code    INTEGER;
ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS error_message TEXT;
-- Outbound rows have no sender phone stored.
ALTER TABLE wa_messages ALTER COLUMN from_phone DROP NOT NULL;

-- Meta re-delivers webhooks; the unique id makes inserts idempotent and lets
-- delivery receipts find their message. Older duplicates are removed first.
DELETE FROM wa_messages a
USING wa_messages b
WHERE a.wa_message_id IS NOT NULL
  AND a.wa_message_id = b.wa_message_id
  AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id));

CREATE UNIQUE INDEX IF NOT EXISTS wa_messages_wa_message_id_uidx
  ON wa_messages (wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wa_messages_user_created_idx ON wa_messages (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_messages_user_from_idx    ON wa_messages (user_id, from_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_messages_user_to_idx      ON wa_messages (user_id, to_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_messages_created_idx      ON wa_messages (created_at);

-- Team members who can be assigned conversations.
CREATE TABLE IF NOT EXISTS team_members (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  email          TEXT,
  role           TEXT        NOT NULL DEFAULT 'agent',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_members_owner_idx ON team_members (owner_user_id, created_at);

-- Which team member handles which conversation (one row per customer phone).
CREATE TABLE IF NOT EXISTS wa_conversations (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone                  TEXT        NOT NULL,
  assigned_to_member_id  UUID        REFERENCES team_members(id) ON DELETE SET NULL,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, phone)
);

CREATE INDEX IF NOT EXISTS wa_conversations_member_idx
  ON wa_conversations (assigned_to_member_id) WHERE assigned_to_member_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 7. BROADCASTS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_broadcasts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  template_id       UUID        REFERENCES wa_templates(id) ON DELETE SET NULL,
  status            TEXT        NOT NULL DEFAULT 'draft',
  scheduled_at      TIMESTAMPTZ,
  variables         JSONB,
  locked_at         TIMESTAMPTZ,
  error             TEXT,
  total_recipients  INTEGER     NOT NULL DEFAULT 0,
  sent_count        INTEGER     NOT NULL DEFAULT 0,
  delivered_count   INTEGER     NOT NULL DEFAULT 0,
  read_count        INTEGER     NOT NULL DEFAULT 0,
  failed_count      INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wa_broadcasts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE wa_broadcasts ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- How each template variable is filled: [{source:"name"}|{source:"phone"}|{source:"text",value:"..."}]
ALTER TABLE wa_broadcasts ADD COLUMN IF NOT EXISTS variables    JSONB;

-- queued: waiting for a worker. sending: a worker holds the lease (locked_at is its
-- heartbeat). paused: stopped on a fixable problem (error says which); sending again resumes.
ALTER TABLE wa_broadcasts ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE wa_broadcasts ADD COLUMN IF NOT EXISTS error     TEXT;
ALTER TABLE wa_broadcasts DROP CONSTRAINT IF EXISTS wa_broadcasts_status_check;
ALTER TABLE wa_broadcasts ADD CONSTRAINT wa_broadcasts_status_check
  CHECK (status IN ('draft', 'scheduled', 'queued', 'sending', 'paused', 'completed', 'failed', 'cancelled')) NOT VALID;
CREATE INDEX IF NOT EXISTS wa_broadcasts_queue_idx ON wa_broadcasts (status, locked_at) WHERE status IN ('queued', 'sending');

CREATE INDEX IF NOT EXISTS wa_broadcasts_user_created_idx ON wa_broadcasts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_broadcasts_due_idx ON wa_broadcasts (scheduled_at) WHERE status = 'scheduled';

DROP TRIGGER IF EXISTS wa_broadcasts_set_updated_at ON wa_broadcasts;
CREATE TRIGGER wa_broadcasts_set_updated_at BEFORE UPDATE ON wa_broadcasts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS wa_broadcast_recipients (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id   UUID        NOT NULL REFERENCES wa_broadcasts(id) ON DELETE CASCADE,
  contact_id     UUID        NOT NULL REFERENCES wa_contacts(id) ON DELETE CASCADE,
  status         TEXT        NOT NULL DEFAULT 'pending',
  wa_message_id  TEXT,
  sent_at        TIMESTAMPTZ,
  error          TEXT
);

ALTER TABLE wa_broadcast_recipients ADD COLUMN IF NOT EXISTS error TEXT;

CREATE INDEX IF NOT EXISTS wa_broadcast_recipients_broadcast_status_idx
  ON wa_broadcast_recipients (broadcast_id, status);
CREATE INDEX IF NOT EXISTS wa_broadcast_recipients_message_idx
  ON wa_broadcast_recipients (wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wa_broadcast_recipients_contact_idx
  ON wa_broadcast_recipients (contact_id);

-- A contact can appear once per broadcast. If old data has duplicates the index is skipped.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS wa_broadcast_recipients_unique_idx
    ON wa_broadcast_recipients (broadcast_id, contact_id);
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Duplicate broadcast recipients exist; unique index skipped.';
END $$;

-- ── Broadcast engine ────────────────────────────────────────────────────────
-- Every step that touches many rows is one set-based statement, so a broadcast to
-- millions of contacts never moves rows through the application one at a time.

-- Adds recipients from explicit contact ids, a label, or every contact. Returns the total.
CREATE OR REPLACE FUNCTION add_broadcast_recipients(
  p_broadcast UUID, p_user UUID, p_contact_ids UUID[] DEFAULT NULL, p_label TEXT DEFAULT NULL, p_all BOOLEAN DEFAULT false
) RETURNS INTEGER AS $$
DECLARE
  total INTEGER;
BEGIN
  INSERT INTO wa_broadcast_recipients (broadcast_id, contact_id, status)
  SELECT p_broadcast, c.id, 'pending'
  FROM wa_contacts c
  WHERE c.user_id = p_user
    AND (p_all OR (p_label IS NOT NULL AND p_label = ANY (c.labels)) OR (p_contact_ids IS NOT NULL AND c.id = ANY (p_contact_ids)))
  ON CONFLICT (broadcast_id, contact_id) DO NOTHING;

  SELECT count(*) INTO total FROM wa_broadcast_recipients WHERE broadcast_id = p_broadcast;
  UPDATE wa_broadcasts SET total_recipients = total WHERE id = p_broadcast;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Who an audience contains and how many would actually be sent to, without creating anything.
CREATE OR REPLACE FUNCTION audience_preview(
  p_user UUID, p_contact_ids UUID[] DEFAULT NULL, p_label TEXT DEFAULT NULL, p_all BOOLEAN DEFAULT false, p_marketing BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
  WITH sel AS (
    SELECT c.is_opted_in, c.consent_purposes FROM wa_contacts c
    WHERE c.user_id = p_user
      AND (p_all OR (p_label IS NOT NULL AND p_label = ANY (c.labels)) OR (p_contact_ids IS NOT NULL AND c.id = ANY (p_contact_ids)))
  )
  SELECT jsonb_build_object(
    'selected', count(*),
    'opted_out', count(*) FILTER (WHERE is_opted_in = false),
    'no_marketing_consent', count(*) FILTER (WHERE p_marketing AND is_opted_in <> false
        AND COALESCE(array_length(consent_purposes, 1), 0) > 0 AND NOT ('marketing_messages' = ANY (consent_purposes))),
    'will_send', count(*) FILTER (WHERE is_opted_in <> false
        AND NOT (p_marketing AND COALESCE(array_length(consent_purposes, 1), 0) > 0 AND NOT ('marketing_messages' = ANY (consent_purposes))))
  ) FROM sel;
$$ LANGUAGE sql STABLE;

-- Skips recipients who must not receive this broadcast: opted out, or (for
-- promotions) without marketing consent. Returns how many of each.
CREATE OR REPLACE FUNCTION skip_ineligible_recipients(p_broadcast UUID, p_marketing BOOLEAN)
RETURNS JSONB AS $$
DECLARE
  opted_out INTEGER;
  no_marketing INTEGER;
BEGIN
  WITH u AS (
    UPDATE wa_broadcast_recipients r SET status = 'skipped', error = 'Contact opted out'
    FROM wa_contacts c
    WHERE r.broadcast_id = p_broadcast AND r.status = 'pending' AND c.id = r.contact_id AND c.is_opted_in = false
    RETURNING 1
  ) SELECT count(*) INTO opted_out FROM u;

  no_marketing := 0;
  IF p_marketing THEN
    WITH u AS (
      UPDATE wa_broadcast_recipients r SET status = 'skipped', error = 'No marketing consent'
      FROM wa_contacts c
      WHERE r.broadcast_id = p_broadcast AND r.status = 'pending' AND c.id = r.contact_id
        AND COALESCE(array_length(c.consent_purposes, 1), 0) > 0
        AND NOT ('marketing_messages' = ANY (c.consent_purposes))
      RETURNING 1
    ) SELECT count(*) INTO no_marketing FROM u;
  END IF;

  RETURN jsonb_build_object('opted_out', opted_out, 'no_marketing_consent', no_marketing);
END;
$$ LANGUAGE plpgsql;

-- Keeps the first p_keep pending recipients and skips the rest (daily messaging limit).
CREATE OR REPLACE FUNCTION limit_broadcast_recipients(p_broadcast UUID, p_keep INTEGER, p_reason TEXT)
RETURNS INTEGER AS $$
DECLARE
  skipped INTEGER;
BEGIN
  WITH over AS (
    SELECT id FROM wa_broadcast_recipients
    WHERE broadcast_id = p_broadcast AND status = 'pending' ORDER BY id OFFSET GREATEST(p_keep, 0)
  ), u AS (
    UPDATE wa_broadcast_recipients r SET status = 'skipped', error = p_reason FROM over WHERE r.id = over.id RETURNING 1
  ) SELECT count(*) INTO skipped FROM u;
  RETURN skipped;
END;
$$ LANGUAGE plpgsql;

-- A worker takes the broadcast. Succeeds for a queued broadcast, or a "sending" one
-- whose worker stopped heartbeating (crash, deploy), which it then resumes.
CREATE OR REPLACE FUNCTION claim_broadcast(p_id UUID, p_stale_seconds INTEGER DEFAULT 120)
RETURNS BOOLEAN AS $$
DECLARE
  prev TEXT;
BEGIN
  SELECT status INTO prev FROM wa_broadcasts WHERE id = p_id FOR UPDATE;
  IF prev = 'queued' OR (prev = 'sending' AND (SELECT locked_at FROM wa_broadcasts WHERE id = p_id) < NOW() - make_interval(secs => p_stale_seconds)) THEN
    UPDATE wa_broadcasts SET status = 'sending', locked_at = NOW(), error = NULL WHERE id = p_id;
    -- Anything the previous worker had in flight goes back in line.
    UPDATE wa_broadcast_recipients SET status = 'pending' WHERE broadcast_id = p_id AND status = 'sending';
    RETURN true;
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Takes the next batch of pending recipients (safe to call from several workers at once).
CREATE OR REPLACE FUNCTION next_broadcast_chunk(p_broadcast UUID, p_limit INTEGER)
RETURNS TABLE (recipient_id UUID, contact_id UUID, phone_number TEXT, display_name TEXT) AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM wa_broadcast_recipients
    WHERE broadcast_id = p_broadcast AND status = 'pending'
    ORDER BY id LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE wa_broadcast_recipients r SET status = 'sending' FROM picked WHERE r.id = picked.id
    RETURNING r.id AS rid, r.contact_id AS cid
  )
  SELECT upd.rid, upd.cid, c.phone_number, c.display_name FROM upd JOIN wa_contacts c ON c.id = upd.cid;
END;
$$ LANGUAGE plpgsql;

-- Records a whole batch of send outcomes at once and updates the broadcast counters.
-- p_results: [{"id": "...", "status": "sent"|"failed"|"skipped", "wamid": "...", "error": "..."}]
CREATE OR REPLACE FUNCTION record_recipient_results(p_broadcast UUID, p_results JSONB)
RETURNS VOID AS $$
BEGIN
  UPDATE wa_broadcast_recipients r SET
    status = x.status,
    wa_message_id = COALESCE(x.wamid, r.wa_message_id),
    sent_at = CASE WHEN x.status = 'sent' THEN NOW() ELSE r.sent_at END,
    error = x.error
  FROM jsonb_to_recordset(p_results) AS x(id UUID, status TEXT, wamid TEXT, error TEXT)
  WHERE r.id = x.id AND r.broadcast_id = p_broadcast;

  UPDATE wa_broadcasts SET
    sent_count = sent_count + (SELECT count(*) FROM jsonb_to_recordset(p_results) AS x(id UUID, status TEXT) WHERE x.status = 'sent'),
    failed_count = failed_count + (SELECT count(*) FROM jsonb_to_recordset(p_results) AS x(id UUID, status TEXT) WHERE x.status = 'failed'),
    locked_at = NOW()
  WHERE id = p_broadcast;
END;
$$ LANGUAGE plpgsql;

-- Distinct customers sent a template in the last 24 hours. Meta's messaging limit counts
-- distinct users messaged outside customer service windows in a rolling 24 hours, so this
-- (not a calendar-day counter) is what a new broadcast must stay under.
CREATE INDEX IF NOT EXISTS wa_broadcast_recipients_sent_at_idx ON wa_broadcast_recipients (sent_at) WHERE sent_at IS NOT NULL;

CREATE OR REPLACE FUNCTION unique_template_recipients_24h(p_user UUID) RETURNS INTEGER AS $$
  SELECT count(DISTINCT r.contact_id)::int
  FROM wa_broadcast_recipients r JOIN wa_broadcasts b ON b.id = r.broadcast_id
  WHERE b.user_id = p_user AND r.sent_at > NOW() - INTERVAL '24 hours' AND r.status IN ('sent', 'delivered', 'read');
$$ LANGUAGE sql STABLE;

-- Counts used to decide whether a broadcast finished.
CREATE OR REPLACE FUNCTION broadcast_progress(p_broadcast UUID) RETURNS JSONB AS $$
  SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb)
  FROM (SELECT status, count(*) AS n FROM wa_broadcast_recipients WHERE broadcast_id = p_broadcast GROUP BY status) t;
$$ LANGUAGE sql STABLE;

-- Applies a sent/delivered/read/failed receipt to a recipient and bumps the
-- broadcast counters exactly once per forward step.
CREATE OR REPLACE FUNCTION apply_broadcast_receipt(p_wa_message_id TEXT, p_status TEXT)
RETURNS void AS $$
DECLARE
  r RECORD;
  old_rank INT;
  new_rank INT;
BEGIN
  SELECT id, broadcast_id, status INTO r
  FROM wa_broadcast_recipients WHERE wa_message_id = p_wa_message_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_status = 'failed' THEN
    IF r.status <> 'failed' THEN
      UPDATE wa_broadcast_recipients SET status = 'failed' WHERE id = r.id;
      UPDATE wa_broadcasts SET failed_count = failed_count + 1 WHERE id = r.broadcast_id;
    END IF;
    RETURN;
  END IF;

  old_rank := CASE r.status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END;
  new_rank := CASE p_status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END;
  IF new_rank <= old_rank THEN RETURN; END IF;

  UPDATE wa_broadcast_recipients SET status = p_status WHERE id = r.id;
  -- A read receipt implies delivery even if the delivered receipt was missed.
  UPDATE wa_broadcasts SET
    delivered_count = delivered_count + CASE WHEN old_rank < 2 AND new_rank >= 2 THEN 1 ELSE 0 END,
    read_count      = read_count      + CASE WHEN new_rank = 3 THEN 1 ELSE 0 END
  WHERE id = r.broadcast_id;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 8. USAGE, API KEYS, WAITLIST
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wa_usage (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  messages_sent_month          INTEGER     NOT NULL DEFAULT 0,
  automations_triggered_month  INTEGER     NOT NULL DEFAULT 0,
  broadcasts_sent_month        INTEGER     NOT NULL DEFAULT 0,
  billing_cycle_start          TIMESTAMPTZ DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API keys belong to app accounts (public.users), not Supabase Auth users.
-- Earlier versions pointed the foreign key at auth.users, which rejects every
-- account created through Facebook login. Recreated here when that is the case.
DO $$
DECLARE
  con RECORD;
BEGIN
  IF to_regclass('public.wa_api_keys') IS NULL OR to_regclass('auth.users') IS NULL THEN
    RETURN;
  END IF;

  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.wa_api_keys'::regclass
      AND contype = 'f'
      AND confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.wa_api_keys DROP CONSTRAINT %I', con.conname);
    DELETE FROM public.wa_api_keys WHERE user_id NOT IN (SELECT id FROM public.users);
    ALTER TABLE public.wa_api_keys
      ADD CONSTRAINT wa_api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END LOOP;
END $$;

-- api_key holds "h_" + SHA-256 of the key (new keys) or a plain-text key (created
-- before hashing; still accepted until the user regenerates). key_prefix is a
-- masked display value such as "rk_live_ab12…f9e0".
CREATE TABLE IF NOT EXISTS wa_api_keys (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  api_key       TEXT        NOT NULL UNIQUE DEFAULT ('rk_live_' || replace(gen_random_uuid()::text, '-', '')),
  key_prefix    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ
);

ALTER TABLE wa_api_keys ADD COLUMN IF NOT EXISTS key_prefix TEXT;

CREATE TABLE IF NOT EXISTS product_waitlist (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product     TEXT        NOT NULL,
  email       TEXT,
  phone       TEXT,
  name        TEXT,
  signup_ip   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 9. BACKGROUND WORKER (Railway)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS worker_job_runs (
  id           BIGSERIAL   PRIMARY KEY,
  job_name     TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'error')),
  details      JSONB,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS worker_job_runs_job_started_idx ON worker_job_runs (job_name, started_at DESC);

CREATE TABLE IF NOT EXISTS worker_locks (
  job_name    TEXT        PRIMARY KEY,
  locked_by   TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Returns true when the caller now holds the lock for p_ttl_seconds.
CREATE OR REPLACE FUNCTION try_acquire_worker_lock(p_job TEXT, p_owner TEXT, p_ttl_seconds INTEGER)
RETURNS boolean AS $$
DECLARE
  acquired boolean;
BEGIN
  INSERT INTO worker_locks (job_name, locked_by, expires_at)
  VALUES (p_job, p_owner, NOW() + make_interval(secs => p_ttl_seconds))
  ON CONFLICT (job_name) DO UPDATE
    SET locked_by = EXCLUDED.locked_by, expires_at = EXCLUDED.expires_at
    WHERE worker_locks.expires_at < NOW() OR worker_locks.locked_by = EXCLUDED.locked_by
  RETURNING true INTO acquired;
  RETURN COALESCE(acquired, false);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_worker_lock(p_job TEXT, p_owner TEXT) RETURNS void AS $$
BEGIN
  DELETE FROM worker_locks WHERE job_name = p_job AND locked_by = p_owner;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION purge_old_worker_runs() RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM worker_job_runs WHERE started_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Message retention (90 days). The worker calls the app-side purge; this
-- function is the same rule for anyone scheduling it with pg_cron instead.
CREATE OR REPLACE FUNCTION purge_old_wa_messages() RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM wa_messages WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY: server (service role) access only
-- ---------------------------------------------------------------------------

ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_connections           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_automations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_templates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_contacts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_consent_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsr_requests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_broadcasts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_broadcast_recipients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_usage                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_api_keys              ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_waitlist         ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_job_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_locks             ENABLE ROW LEVEL SECURITY;

-- Drop policies from earlier schema versions. The service role bypasses RLS,
-- and per-user policies keyed on auth.uid() never matched app accounts.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'users', 'wa_connections', 'wa_automations', 'wa_templates', 'wa_contacts',
        'wa_consent_logs', 'dsr_requests', 'wa_messages', 'team_members', 'wa_conversations',
        'wa_broadcasts', 'wa_broadcast_recipients', 'wa_usage', 'wa_api_keys',
        'product_waitlist', 'worker_job_runs', 'worker_locks'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 11. OPTIONAL CLEAN-UP of removed features (run manually, irreversible)
-- ---------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS deduct_wallet_balance(UUID, INTEGER);
-- DROP TABLE IF EXISTS wa_wallet_transactions, wa_wallet CASCADE;
-- DROP TABLE IF EXISTS ad_leads, ad_automations, ad_campaigns, ad_connections, ctwa_campaigns CASCADE;
-- ALTER TABLE wa_connections DROP COLUMN IF EXISTS billing_type;

-- Make PostgREST pick up the new columns and functions immediately.
NOTIFY pgrst, 'reload schema';
