-- Meta WhatsApp Business Platform policy compliance additions

-- 1. Add opt-in/opt-out tracking columns to wa_contacts
ALTER TABLE wa_contacts
  ADD COLUMN IF NOT EXISTS opted_in_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opted_out_at  TIMESTAMPTZ;

-- Backfill: existing contacts who have messaged us are considered opted-in
-- (they initiated contact, which constitutes implied consent for service messages)
UPDATE wa_contacts SET opted_in_at = created_at WHERE opted_in_at IS NULL AND is_opted_in = true;

-- 2. Add facebook_user_id to users table so the deletion callback can find accounts
ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_user_id TEXT;
CREATE INDEX IF NOT EXISTS users_facebook_user_id_idx ON users(facebook_user_id);

-- 3. Add scheduled_at to wa_broadcasts if not already added by earlier migration
ALTER TABLE wa_broadcasts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- 4. Add updated_at to wa_broadcasts if missing
ALTER TABLE wa_broadcasts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Message auto-purge function (90-day retention — Meta data minimisation requirement)
CREATE OR REPLACE FUNCTION purge_old_wa_messages() RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM wa_messages
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Update the upsert_wa_contact function to record opt-in timestamp
CREATE OR REPLACE FUNCTION upsert_wa_contact(
  p_user_id UUID,
  p_phone TEXT,
  p_name TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO wa_contacts (user_id, phone_number, display_name, last_message_at, message_count, is_opted_in, opted_in_at)
  VALUES (p_user_id, p_phone, p_name, NOW(), 1, true, NOW())
  ON CONFLICT (user_id, phone_number)
  DO UPDATE SET
    last_message_at = NOW(),
    message_count   = wa_contacts.message_count + 1,
    display_name    = COALESCE(EXCLUDED.display_name, wa_contacts.display_name),
    opted_in_at     = COALESCE(wa_contacts.opted_in_at, NOW());
END;
$$ LANGUAGE plpgsql;

-- 7. Index to efficiently query opted-in contacts for broadcasts
CREATE INDEX IF NOT EXISTS wa_contacts_opted_in_idx ON wa_contacts(user_id, is_opted_in) WHERE is_opted_in = true;
