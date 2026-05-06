-- WhatsApp Contacts CRM
CREATE TABLE IF NOT EXISTS wa_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  display_name TEXT,
  labels TEXT[] DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  is_opted_in BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phone_number)
);

-- WhatsApp Broadcasts
CREATE TABLE IF NOT EXISTS wa_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_id UUID REFERENCES wa_templates(id),
  status TEXT DEFAULT 'draft',
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Broadcast Recipients
CREATE TABLE IF NOT EXISTS wa_broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID REFERENCES wa_broadcasts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES wa_contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  wa_message_id TEXT,
  sent_at TIMESTAMPTZ,
  error TEXT
);

-- WhatsApp Usage Tracking
CREATE TABLE IF NOT EXISTS wa_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  messages_sent_month INTEGER DEFAULT 0,
  automations_triggered_month INTEGER DEFAULT 0,
  broadcasts_sent_month INTEGER DEFAULT 0,
  billing_cycle_start TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE wa_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON wa_contacts FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_broadcasts FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_broadcast_recipients FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_usage FOR ALL TO service_role USING (true);

-- Auto-create contacts from incoming messages (function)
CREATE OR REPLACE FUNCTION upsert_wa_contact(
  p_user_id UUID,
  p_phone TEXT,
  p_name TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO wa_contacts (user_id, phone_number, display_name, last_message_at, message_count)
  VALUES (p_user_id, p_phone, p_name, NOW(), 1)
  ON CONFLICT (user_id, phone_number)
  DO UPDATE SET
    last_message_at = NOW(),
    message_count = wa_contacts.message_count + 1,
    display_name = COALESCE(EXCLUDED.display_name, wa_contacts.display_name);
END;
$$ LANGUAGE plpgsql;
