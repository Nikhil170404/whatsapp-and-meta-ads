-- WhatsApp connections (one per user — their connected WABA)
CREATE TABLE wa_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  phone_number_id TEXT NOT NULL,        -- Meta Phone Number ID
  waba_id TEXT NOT NULL,                -- WhatsApp Business Account ID
  phone_number TEXT NOT NULL,           -- display e.g. +91 98765 43210
  display_name TEXT,
  access_token TEXT NOT NULL,           -- system user token
  token_expires_at TIMESTAMPTZ,         -- null = permanent token
  webhook_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',         -- 'active' | 'disconnected' | 'expired'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp automations (keyword → reply)
CREATE TABLE wa_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_keyword TEXT,                 -- null = any message
  trigger_type TEXT DEFAULT 'keyword',  -- 'keyword' | 'any' | 'welcome'
  reply_message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp messages inbox
CREATE TABLE wa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wa_message_id TEXT UNIQUE,            -- Meta's message ID (for dedup)
  from_phone TEXT NOT NULL,
  to_phone TEXT NOT NULL,
  direction TEXT NOT NULL,              -- 'inbound' | 'outbound'
  message_type TEXT DEFAULT 'text',     -- 'text' | 'template' | 'image'
  content TEXT,
  status TEXT DEFAULT 'delivered',      -- 'sent' | 'delivered' | 'read' | 'failed'
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message templates
CREATE TABLE wa_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  language TEXT DEFAULT 'en_US',
  category TEXT DEFAULT 'UTILITY',      -- 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  body_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending',        -- 'pending' | 'approved' | 'rejected'
  meta_template_id TEXT,               -- ID returned by Meta after approval
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: service role full access
ALTER TABLE wa_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON wa_connections FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_automations FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_messages FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_templates FOR ALL TO service_role USING (true);
