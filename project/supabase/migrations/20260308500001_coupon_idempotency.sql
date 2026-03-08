-- Coupon usage idempotency: prevents double-counting from webhook retries
-- and race conditions from concurrent webhooks

-- 1. Track individual coupon uses with UNIQUE constraint
CREATE TABLE IF NOT EXISTS coupon_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(coupon_id, order_id)
);

-- 2. Atomic increment function (idempotent via UNIQUE constraint)
CREATE OR REPLACE FUNCTION increment_coupon_usage(
  p_coupon_id UUID,
  p_order_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Try to insert into coupon_uses (fails on duplicate = idempotent)
  INSERT INTO coupon_uses (coupon_id, order_id)
  VALUES (p_coupon_id, p_order_id);

  -- Atomic increment
  UPDATE coupons SET times_used = times_used + 1 WHERE id = p_coupon_id;

  RETURN TRUE;
EXCEPTION WHEN unique_violation THEN
  -- Already counted for this order — idempotent skip
  RETURN FALSE;
END;
$$;
