-- Fix overly permissive RLS policy on user_usage table
-- Only service_role should access this table (server-side usage tracking)

DROP POLICY IF EXISTS "Service role full access on user_usage" ON user_usage;
DROP POLICY IF EXISTS "Anyone can read user_usage" ON user_usage;
DROP POLICY IF EXISTS "Anyone can insert user_usage" ON user_usage;
DROP POLICY IF EXISTS "Anyone can update user_usage" ON user_usage;

-- Ensure RLS is enabled
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- Service role only (not accessible from client-side Supabase)
CREATE POLICY "Service role manages user_usage"
  ON user_usage FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
