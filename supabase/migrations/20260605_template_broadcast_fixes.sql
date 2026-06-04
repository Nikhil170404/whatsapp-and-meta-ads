-- Add meta_template_id to wa_templates for tracking Meta submission
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS meta_template_id TEXT;

-- Add unique constraint on user_id,name for upsert support
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wa_templates_user_id_name_key'
  ) THEN
    ALTER TABLE wa_templates ADD CONSTRAINT wa_templates_user_id_name_key UNIQUE (user_id, name);
  END IF;
END $$;

-- Add updated_at to wa_broadcasts for tracking
ALTER TABLE wa_broadcasts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add error column to wa_broadcast_recipients (schema uses "error" not "error_message")
ALTER TABLE wa_broadcast_recipients ADD COLUMN IF NOT EXISTS error TEXT;
