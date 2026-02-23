-- Create advisory lock function for cron jobs
-- Returns TRUE if lock acquired, FALSE if already held by another session
-- Uses PostgreSQL advisory locks to prevent concurrent cron job execution

CREATE OR REPLACE FUNCTION try_cron_lock(
  p_cron_name text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_key bigint;
BEGIN
  -- Convert cron job name to a numeric lock key
  -- hashtext() returns a stable hash for the same input
  v_lock_key := hashtext(p_cron_name);

  -- Try to acquire advisory lock (non-blocking)
  -- Returns TRUE if lock acquired, FALSE if already held
  RETURN pg_try_advisory_lock(v_lock_key);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION try_cron_lock(text) TO authenticated;
GRANT EXECUTE ON FUNCTION try_cron_lock(text) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION try_cron_lock(text) IS 'Acquires an advisory lock for a cron job. Returns TRUE if acquired, FALSE if already held by another session. Prevents concurrent execution of the same cron job.';
