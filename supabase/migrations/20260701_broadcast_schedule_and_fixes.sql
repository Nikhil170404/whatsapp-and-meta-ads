-- Add scheduled_at to wa_broadcasts (was missing from initial schema)
ALTER TABLE wa_broadcasts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Raise the default Supabase row limit for large contact ownership checks
-- (handled in application code via range queries; no schema change needed)
