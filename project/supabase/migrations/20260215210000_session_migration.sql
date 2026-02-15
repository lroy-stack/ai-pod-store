-- Session migration: merge anonymous usage into authenticated user
CREATE OR REPLACE FUNCTION migrate_usage(
  p_old_identifier TEXT,
  p_new_identifier TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_migrated INTEGER := 0;
BEGIN
  -- Merge counts: add old anonymous counts to new user identifier
  INSERT INTO user_usage (identifier, action, period, count)
  SELECT p_new_identifier, action, period, count
  FROM user_usage WHERE identifier = p_old_identifier
  ON CONFLICT (identifier, action, period)
  DO UPDATE SET count = user_usage.count + EXCLUDED.count;

  GET DIAGNOSTICS v_migrated = ROW_COUNT;

  -- Delete old anonymous records
  DELETE FROM user_usage WHERE identifier = p_old_identifier;

  RETURN v_migrated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
