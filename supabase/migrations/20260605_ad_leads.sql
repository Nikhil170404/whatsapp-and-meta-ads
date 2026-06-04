CREATE TABLE IF NOT EXISTS ad_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  page_id TEXT,
  lead_id TEXT UNIQUE,
  name TEXT,
  email TEXT,
  phone TEXT,
  raw_data JSONB,
  whatsapp_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ad_connections ADD COLUMN IF NOT EXISTS page_access_token TEXT;
ALTER TABLE ad_connections ADD COLUMN IF NOT EXISTS ig_user_id TEXT;
ALTER TABLE ad_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON ad_leads FOR ALL TO service_role USING (true);
