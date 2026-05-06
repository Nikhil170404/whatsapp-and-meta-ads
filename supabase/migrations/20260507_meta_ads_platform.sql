-- Meta Ads connections
CREATE TABLE ad_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  fb_user_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,          -- act_XXXXXXX
  page_id TEXT,
  page_access_token TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cached campaign data (synced daily)
CREATE TABLE ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  name TEXT,
  status TEXT,
  objective TEXT,
  daily_budget BIGINT,
  lifetime_budget BIGINT,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend NUMERIC(10,2) DEFAULT 0,
  ctr NUMERIC(6,4) DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, campaign_id)
);

-- Comment automation on ad posts
CREATE TABLE ad_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  campaign_id TEXT,
  ad_id TEXT,
  trigger_keyword TEXT,
  reply_message TEXT NOT NULL,
  send_dm BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product waitlist (for /whatsapp and /meta-ads landing pages)
CREATE TABLE product_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product TEXT NOT NULL,                -- 'whatsapp' | 'meta-ads'
  email TEXT,
  phone TEXT,
  name TEXT,
  signup_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ad_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON ad_connections FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON ad_campaigns FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON ad_automations FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON product_waitlist FOR ALL TO service_role USING (true);
