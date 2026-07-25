-- Interactive & media message support for automations
-- message_type: 'text' | 'image' | 'video' | 'document' | 'buttons'
-- media_url: public HTTPS URL for image/video/document
-- button_options: { buttons: [{id,title},...] } for 'buttons' type
--                 { filename: "..." } for 'document' type
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS button_options JSONB;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
