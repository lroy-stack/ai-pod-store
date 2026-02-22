-- Increment usage by arbitrary amount (for token tracking)
CREATE OR REPLACE FUNCTION increment_usage_by(
  p_identifier VARCHAR, p_action VARCHAR, p_period VARCHAR,
  p_amount INTEGER, p_limit INTEGER
) RETURNS JSONB AS $$
DECLARE v_current INTEGER;
BEGIN
  INSERT INTO user_usage (identifier, action, period, count)
  VALUES (p_identifier, p_action, p_period, p_amount)
  ON CONFLICT (identifier, action, period) DO UPDATE
    SET count = user_usage.count + p_amount, updated_at = now()
  RETURNING count INTO v_current;

  RETURN jsonb_build_object('current', v_current, 'limit', p_limit, 'over', v_current > p_limit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
