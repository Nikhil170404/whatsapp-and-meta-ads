-- Atomic wallet deduction function — prevents race conditions across all send paths
CREATE OR REPLACE FUNCTION deduct_wallet_balance(
  p_user_id UUID,
  p_amount INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  SELECT balance_paise INTO v_balance
  FROM wa_wallet
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: % < %', v_balance, p_amount;
  END IF;

  v_new_balance := v_balance - p_amount;

  UPDATE wa_wallet
  SET balance_paise = v_new_balance,
      total_spent_paise = total_spent_paise + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- Prevent double-crediting the same Razorpay payment
ALTER TABLE wa_wallet_transactions
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wa_wallet_transactions_razorpay_payment_id_key'
  ) THEN
    ALTER TABLE wa_wallet_transactions
      ADD CONSTRAINT wa_wallet_transactions_razorpay_payment_id_key
      UNIQUE (razorpay_payment_id);
  END IF;
END $$;
