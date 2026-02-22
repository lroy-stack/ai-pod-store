-- Drop all existing policies
DROP POLICY IF EXISTS "Allow error inserts" ON error_logs;
DROP POLICY IF EXISTS "Service role can read error_logs" ON error_logs;
DROP POLICY IF EXISTS "Allow error updates" ON error_logs;
DROP POLICY IF EXISTS "Service role can delete error_logs" ON error_logs;

-- Grant table permissions to anon and authenticated roles
GRANT INSERT, SELECT, UPDATE ON error_logs TO anon, authenticated;

-- Create policies with explicit TO clauses
CREATE POLICY "anon_can_insert_errors"
  ON error_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "authenticated_can_insert_errors"
  ON error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "anon_can_select_errors"
  ON error_logs
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "authenticated_can_select_errors"
  ON error_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "anon_can_update_errors"
  ON error_logs
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_can_update_errors"
  ON error_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_full_access"
  ON error_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
