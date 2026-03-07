-- Drop permissive anon/authenticated policies on error_logs
-- Only service_role should read/write error logs
DROP POLICY IF EXISTS "anon_can_select_errors" ON error_logs;
DROP POLICY IF EXISTS "anon_can_insert_errors" ON error_logs;
DROP POLICY IF EXISTS "authenticated_can_select_errors" ON error_logs;
DROP POLICY IF EXISTS "authenticated_can_insert_errors" ON error_logs;
