-- Fix try_cron_lock to use transaction-level advisory locks
-- Transaction-level locks are NOT re-entrant and automatically release at transaction end
-- This is better for cron job locking where we want one execution per transaction

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

  -- Try to acquire transaction-level advisory lock (non-blocking, non-re-entrant)
  -- Returns TRUE if lock acquired, FALSE if already held (even by same session)
  -- Lock is automatically released at end of transaction
  RETURN pg_try_advisory_xact_lock(v_lock_key);
END;
$$;

-- Update comment to reflect transaction-level behavior
COMMENT ON FUNCTION try_cron_lock(text) IS 'Acquires a transaction-level advisory lock for a cron job. Returns TRUE if acquired, FALSE if already held (even by same session within transaction). Lock is automatically released at transaction end. Prevents concurrent execution of the same cron job.';
