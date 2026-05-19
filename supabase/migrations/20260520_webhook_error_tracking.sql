-- Surface webhook/automation errors in the UI instead of swallowing them silently
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;

ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS last_fired_at TIMESTAMPTZ;
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS last_error TEXT;
