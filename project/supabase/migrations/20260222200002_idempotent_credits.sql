-- V1 Fix: Idempotent credit processing
-- Adds UNIQUE constraints to prevent duplicate orders and credit transactions on Stripe webhook retries.
-- Adds atomic add_credits RPC to replace SELECT-then-UPDATE pattern.

-- 1. UNIQUE on orders(stripe_session_id) — prevents duplicate order creation
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_session_unique
  ON orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- 2. UNIQUE on credit_transactions(user_id, stripe_payment_id) — prevents duplicate credit additions
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_unique_payment
  ON credit_transactions (user_id, stripe_payment_id) WHERE stripe_payment_id IS NOT NULL;

-- 3. Atomic add_credits RPC — replaces SELECT balance → compute → UPDATE pattern
CREATE OR REPLACE FUNCTION add_credits(p_user_id UUID, p_amount INTEGER)
RETURNS JSONB AS $$
DECLARE v_balance INTEGER;
BEGIN
  UPDATE users SET credit_balance = credit_balance + p_amount
  WHERE id = p_user_id
  RETURNING credit_balance INTO v_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'balance', 0);
  END IF;

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
