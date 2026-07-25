-- =============================================================================
-- Meta WhatsApp API Compliance — quality rating, messaging tier, 24h window
-- Safe to run multiple times.
-- =============================================================================

-- Quality rating from Meta: HIGH / MEDIUM / LOW / UNKNOWN
-- Messaging tier controls how many unique users/day you can reach:
--   Tier 1 = 1 000   Tier 2 = 10 000   Tier 3 = 100 000   Tier 4 = unlimited
-- quality_paused_at records when we auto-paused automations due to LOW quality.
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS quality_rating       TEXT        DEFAULT 'UNKNOWN';
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS messaging_tier       INTEGER     DEFAULT 1;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS quality_paused_at   TIMESTAMPTZ;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS quality_synced_at   TIMESTAMPTZ;

-- Track how many unique users were messaged today (resets at midnight UTC).
-- Used to enforce tier-based daily limits before a broadcast starts.
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS daily_unique_sent     INTEGER     DEFAULT 0;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS daily_sent_reset_at   TIMESTAMPTZ DEFAULT NOW();

-- Token refresh tracking (set by the proactive token-refresh cron).
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS token_refresh_failed_at  TIMESTAMPTZ;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS token_warning_sent_at    TIMESTAMPTZ;

-- ─── wa_contacts: track last inbound message time for 24-hour window ────────
-- Meta only allows free-form text within 24 h of the customer's last message.
-- Outside that window ONLY approved templates may be sent.
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS last_customer_message_at  TIMESTAMPTZ;

-- ─── wa_messages: add delivery failure reason ────────────────────────────────
ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS error_code     INTEGER;
ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS error_message  TEXT;

-- ─── Reload PostgREST schema cache ───────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
