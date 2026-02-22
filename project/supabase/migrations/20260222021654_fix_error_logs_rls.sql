-- Drop existing policies
DROP POLICY IF EXISTS "Service role can manage error_logs" ON error_logs;
DROP POLICY IF EXISTS "Authenticated users can insert error_logs" ON error_logs;
DROP POLICY IF EXISTS "Anonymous users can insert error_logs" ON error_logs;

-- Create simpler policies that work
-- Allow anyone (anon, authenticated, service) to insert errors
CREATE POLICY "Allow error inserts"
  ON error_logs
  FOR INSERT
  WITH CHECK (true);

-- Allow SELECT for error reading (service role only for now)
CREATE POLICY "Service role can read error_logs"
  ON error_logs
  FOR SELECT
  TO service_role
  USING (true);

-- Allow UPDATE for incrementing counts
CREATE POLICY "Allow error updates"
  ON error_logs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow service role to delete (for cleanup)
CREATE POLICY "Service role can delete error_logs"
  ON error_logs
  FOR DELETE
  TO service_role
  USING (true);
