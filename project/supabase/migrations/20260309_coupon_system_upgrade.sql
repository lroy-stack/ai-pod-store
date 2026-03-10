-- Coupon System Upgrade — 2026-03-09
-- Adds: per-user limits, first-purchase-only, personal codes, order tracking

-- 1a. ALTER coupons — new columns
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS per_user_limit INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_purchase_only BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS code_type VARCHAR(20) DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(100);

DO $$ BEGIN
  ALTER TABLE coupons ADD CONSTRAINT coupons_code_type_check
    CHECK (code_type IN ('public', 'personal', 'bulk'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1b. ALTER coupon_uses — user tracking + discount amount
ALTER TABLE coupon_uses
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS discount_cents INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_coupon_uses_user
  ON coupon_uses(user_id, coupon_id);

-- 1c. ALTER orders — coupon tracking
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS discount_cents INTEGER DEFAULT 0;

-- 1d. RLS on coupon_uses
ALTER TABLE coupon_uses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own coupon uses"
    ON coupon_uses FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1e. Update RPC with new params (backward compatible)
CREATE OR REPLACE FUNCTION increment_coupon_usage(
  p_coupon_id UUID,
  p_order_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_discount_cents INTEGER DEFAULT 0
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO coupon_uses (coupon_id, order_id, user_id, discount_cents)
  VALUES (p_coupon_id, p_order_id, p_user_id, p_discount_cents);

  UPDATE coupons SET times_used = times_used + 1 WHERE id = p_coupon_id;
  RETURN TRUE;
EXCEPTION WHEN unique_violation THEN
  RETURN FALSE;
END;
$$;

-- 1f. Update WELCOME10 to first-purchase-only, 1 per user
UPDATE coupons SET per_user_limit = 1, first_purchase_only = TRUE
WHERE code = 'WELCOME10';
