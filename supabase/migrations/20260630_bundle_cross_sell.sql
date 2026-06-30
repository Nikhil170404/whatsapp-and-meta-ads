-- Cross-sell bundle redemptions: lets a customer of the sister product
-- (ReplyKaro Instagram automation, replykaro.com) redeem a signed bundle
-- code here for a one-time wallet credit, and vice versa. See lib/cross-sell.ts.
CREATE TABLE IF NOT EXISTS bundle_redemptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE,
  source_uid            UUID NOT NULL,
  redeemed_by_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  granted_credit_paise  INTEGER NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bundle_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON bundle_redemptions FOR ALL TO service_role USING (true);
