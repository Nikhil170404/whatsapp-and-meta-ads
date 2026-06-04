ALTER TABLE wa_connections ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'direct';

CREATE TABLE IF NOT EXISTS wa_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  balance_paise INTEGER DEFAULT 0,
  total_topped_up_paise INTEGER DEFAULT 0,
  total_spent_paise INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  balance_after_paise INTEGER NOT NULL,
  description TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wa_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON wa_wallet FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON wa_wallet_transactions FOR ALL TO service_role USING (true);
