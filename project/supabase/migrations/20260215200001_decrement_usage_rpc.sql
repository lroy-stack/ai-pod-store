-- RPC function to decrement usage counter (rollback on failed actions)
-- Used when a design generation or other counted action fails after incrementing

CREATE OR REPLACE FUNCTION decrement_usage(
  p_identifier TEXT,
  p_action TEXT,
  p_period TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_usage
  SET count = GREATEST(count - 1, 0)
  WHERE identifier = p_identifier
    AND action = p_action
    AND period = p_period;
END;
$$;
