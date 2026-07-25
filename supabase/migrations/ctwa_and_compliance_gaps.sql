-- CTWA 72h window tracking
-- When a customer messages after clicking a Click-to-WhatsApp (CTWA) ad,
-- Meta extends their messaging window from 24 hours to 72 hours.
-- We store the expiry timestamp so the UI can show window status.
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS ctwa_window_expires_at TIMESTAMPTZ;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
