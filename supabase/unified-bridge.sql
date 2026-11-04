-- ============================================================================
-- Link between this WhatsApp app (replykaro.in) and ReplyKaro Unified (replykaro.com).
-- Run once in the Supabase SQL editor of THIS (.in) project. Safe to run again. Purely additive.
--
--   bridge_links          which .com account this account is linked to (Link ID, address, encrypted secret)
--   bridge_outbox         events waiting to be pushed to .com (retried until delivered)
--   wa_contacts.automation_paused_until   take over: no automations or AI replies for this person until then
--   wa_messages.origin    'bridge' = sent from .com, 'dashboard' = typed by a person here (nothing else = automation)
--   trigger on wa_messages   every outbound message is queued for .com, whichever code path sent it
-- ============================================================================

CREATE TABLE IF NOT EXISTS bridge_links (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  link_id         TEXT        NOT NULL UNIQUE,                    -- the Link ID from .com (sent back in x-rk-link)
  com_url         TEXT        NOT NULL,                           -- e.g. https://www.replykaro.com/api/webhooks/wa-bridge
  signing_secret  TEXT        NOT NULL,                           -- encrypted with TOKEN_ENCRYPTION_KEY
  status          TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'error')),
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_push_at    TIMESTAMPTZ,
  last_error      TEXT
);

CREATE TABLE IF NOT EXISTS bridge_outbox (
  id               BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at     TIMESTAMPTZ,
  attempts         INTEGER     NOT NULL DEFAULT 0,
  event_type       TEXT        NOT NULL CHECK (event_type IN ('message.inbound', 'message.outbound', 'consent.changed', 'contact.updated')),
  dedupe_key       TEXT        NOT NULL,
  payload          JSONB       NOT NULL,
  last_error       TEXT,
  CONSTRAINT bridge_outbox_dedupe UNIQUE (user_id, dedupe_key)
) WITH (autovacuum_vacuum_insert_scale_factor = 0.05);
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_due ON bridge_outbox (next_attempt_at) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_delivered ON bridge_outbox (delivered_at) WHERE delivered_at IS NOT NULL;

ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS automation_paused_until TIMESTAMPTZ;
ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS origin TEXT;

-- Queue one event, only when the account is linked. One round trip; a repeat of the same event is ignored.
CREATE OR REPLACE FUNCTION bridge_enqueue(p_user UUID, p_type TEXT, p_key TEXT, p_data JSONB)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM bridge_links WHERE user_id = p_user AND status = 'active') THEN
    INSERT INTO bridge_outbox (user_id, event_type, dedupe_key, payload)
    VALUES (p_user, p_type, p_key, jsonb_build_object('type', p_type, 'dedupe_key', p_key, 'data', p_data))
    ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  END IF;
END $$;

-- Claim due events for one worker. The lease keeps other workers away; a crashed worker's rows come back after it.
CREATE OR REPLACE FUNCTION bridge_claim(p_limit INTEGER DEFAULT 50, p_lease_seconds INTEGER DEFAULT 60)
RETURNS TABLE (id BIGINT, user_id UUID, attempts INTEGER, payload JSONB) LANGUAGE sql AS $$
  WITH due AS (
    SELECT o.id FROM bridge_outbox o
    WHERE o.delivered_at IS NULL AND o.next_attempt_at <= NOW()
    ORDER BY o.next_attempt_at, o.id
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE bridge_outbox o SET next_attempt_at = NOW() + make_interval(secs => GREATEST(p_lease_seconds, 5)), attempts = o.attempts + 1
  FROM due WHERE o.id = due.id
  RETURNING o.id, o.user_id, o.attempts, o.payload;
$$;

-- Outcome of one push: 'ok' | 'retry' | 'dead' (dead rows stay for inspection and are never claimed again).
CREATE OR REPLACE FUNCTION bridge_finish(p_id BIGINT, p_outcome TEXT, p_error TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_outcome = 'ok' THEN
    UPDATE bridge_outbox SET delivered_at = NOW(), last_error = NULL WHERE id = p_id;
  ELSIF p_outcome = 'dead' THEN
    UPDATE bridge_outbox SET next_attempt_at = 'infinity', last_error = left(p_error, 500) WHERE id = p_id;
  ELSE
    UPDATE bridge_outbox SET last_error = left(p_error, 500),
      next_attempt_at = NOW() + make_interval(secs => LEAST(3600, 30 * (2 ^ LEAST(attempts, 7))::INTEGER))
    WHERE id = p_id;
  END IF;
END $$;

-- Keep the outbox small: delivered rows after N days.
CREATE OR REPLACE FUNCTION bridge_purge(p_days INTEGER DEFAULT 7)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE n BIGINT;
BEGIN
  DELETE FROM bridge_outbox WHERE delivered_at IS NOT NULL AND delivered_at < NOW() - make_interval(days => GREATEST(p_days, 1));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Every outbound message (automation, flow, away message, dashboard, API) is queued for .com.
-- Messages that .com itself asked us to send (origin = 'bridge') are not echoed back.
CREATE OR REPLACE FUNCTION bridge_on_outbound() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.direction = 'outbound' AND NEW.origin IS DISTINCT FROM 'bridge' AND NEW.to_phone ~ '^\d{7,15}$' THEN
    PERFORM bridge_enqueue(NEW.user_id, 'message.outbound', 'out:' || COALESCE(NEW.wa_message_id, NEW.id::TEXT),
      jsonb_build_object('wa_id', NEW.to_phone, 'text', COALESCE(left(NEW.content, 1000), ''), 'at', NEW.created_at,
        'by', CASE WHEN NEW.origin = 'dashboard' THEN 'teammate' ELSE 'automation' END));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wa_messages_bridge_outbound ON wa_messages;
CREATE TRIGGER wa_messages_bridge_outbound AFTER INSERT ON wa_messages
  FOR EACH ROW WHEN (NEW.direction = 'outbound') EXECUTE FUNCTION bridge_on_outbound();

ALTER TABLE bridge_links  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_outbox ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
