-- Create a test function that demonstrates lock behavior within a single session
-- This function verifies that try_cron_lock() prevents duplicate lock acquisition
CREATE OR REPLACE FUNCTION test_try_cron_lock_behavior()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_first_attempt boolean;
  v_second_attempt boolean;
  v_third_attempt_diff_name boolean;
BEGIN
  -- First attempt: should succeed (return TRUE)
  v_first_attempt := try_cron_lock('test_lock_demo');

  -- Second attempt with same name: should fail (return FALSE) because lock already held
  v_second_attempt := try_cron_lock('test_lock_demo');

  -- Third attempt with different name: should succeed (return TRUE)
  v_third_attempt_diff_name := try_cron_lock('different_lock');

  -- Return results as JSON
  RETURN jsonb_build_object(
    'first_attempt', v_first_attempt,
    'second_attempt_same_lock', v_second_attempt,
    'third_attempt_different_lock', v_third_attempt_diff_name,
    'test_passed', (v_first_attempt = true AND v_second_attempt = false AND v_third_attempt_diff_name = true)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION test_try_cron_lock_behavior() TO service_role;
GRANT EXECUTE ON FUNCTION test_try_cron_lock_behavior() TO authenticated;

-- Add comment
COMMENT ON FUNCTION test_try_cron_lock_behavior() IS 'Test function to verify try_cron_lock() prevents duplicate acquisitions within same session';
