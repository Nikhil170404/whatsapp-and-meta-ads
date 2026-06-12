ALTER TABLE ad_connections ADD COLUMN IF NOT EXISTS page_id TEXT;
ALTER TABLE ad_connections ADD COLUMN IF NOT EXISTS page_access_token TEXT;
