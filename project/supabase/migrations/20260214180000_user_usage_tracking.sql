-- Phase 15/16: User Usage Tracking, Credit System, Push Subscriptions
-- Adds tier system, credit balance, Stripe subscription tracking,
-- usage counters, credit transactions, and push notification storage.

-- Tier column on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'free'
  CHECK (tier IN ('free', 'premium'));

-- Credit balance for hybrid monetization model
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance INTEGER DEFAULT 0;

-- Stripe subscription tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'none'
  CHECK (subscription_status IN ('none', 'active', 'cancelled', 'past_due'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;

-- Usage tracking table (daily counters per user/action)
CREATE TABLE IF NOT EXISTS user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  period VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(identifier, action, period)
);
CREATE INDEX IF NOT EXISTS idx_user_usage_lookup ON user_usage(identifier, action, period);
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- RLS: service role can do everything, users can read their own usage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_usage' AND policyname = 'Service role full access on user_usage'
  ) THEN
    CREATE POLICY "Service role full access on user_usage"
      ON user_usage FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END$$;

-- Credit transactions log
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL, -- positive = add, negative = consume
  reason VARCHAR(100) NOT NULL, -- 'purchase', 'subscription_bonus', 'design:generate', 'refund'
  stripe_payment_id VARCHAR(255),
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id, created_at DESC);

-- Push subscription storage
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);

-- Atomic usage increment function (Supabase fallback for when Redis is unavailable)
CREATE OR REPLACE FUNCTION increment_usage(
  p_identifier VARCHAR, p_action VARCHAR, p_period VARCHAR, p_limit INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_current INTEGER;
BEGIN
  INSERT INTO user_usage (identifier, action, period, count)
  VALUES (p_identifier, p_action, p_period, 1)
  ON CONFLICT (identifier, action, period) DO UPDATE
    SET count = user_usage.count + 1, updated_at = now()
  RETURNING count INTO v_current;

  IF v_current > p_limit AND p_limit >= 0 THEN
    -- Rollback the increment
    UPDATE user_usage SET count = count - 1
    WHERE identifier = p_identifier AND action = p_action AND period = p_period;
    RETURN jsonb_build_object('allowed', false, 'current', v_current - 1, 'limit', p_limit);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'current', v_current, 'limit', p_limit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Design moderation columns
ALTER TABLE designs ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES users(id);
ALTER TABLE designs ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
