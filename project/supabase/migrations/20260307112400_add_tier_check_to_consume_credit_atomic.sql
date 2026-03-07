-- Add tier='premium' check to consume_credit_atomic() to prevent free users from spending credits
CREATE OR REPLACE FUNCTION consume_credit_atomic(p_user_id UUID, p_action VARCHAR)
RETURNS JSONB AS $$
DECLARE
  v_balance INTEGER;
  v_tier    VARCHAR;
BEGIN
  -- Only premium users may spend credits
  SELECT tier INTO v_tier FROM users WHERE id = p_user_id;

  IF v_tier IS DISTINCT FROM 'premium' THEN
    RETURN jsonb_build_object('success', false, 'error', 'credits_require_premium', 'balance', 0);
  END IF;

  UPDATE users SET credit_balance = credit_balance - 1
  WHERE id = p_user_id AND credit_balance > 0
  RETURNING credit_balance INTO v_balance;

  IF NOT FOUND THEN
    SELECT credit_balance INTO v_balance FROM users WHERE id = p_user_id;
    RETURN jsonb_build_object('success', false, 'balance', COALESCE(v_balance, 0));
  END IF;

  INSERT INTO credit_transactions (user_id, amount, reason, balance_after)
  VALUES (p_user_id, -1, p_action, v_balance);

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
