-- Function to test partition pruning via EXPLAIN
-- Returns the EXPLAIN output as text to verify pruning is working

CREATE OR REPLACE FUNCTION test_partition_pruning()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  explain_output TEXT;
BEGIN
  -- Test EXPLAIN on agent_events with time range (should only scan Feb 2026 partition)
  EXPLAIN (FORMAT TEXT)
    SELECT * FROM agent_events
    WHERE created_at >= '2026-02-01' AND created_at < '2026-02-28'
  INTO explain_output;

  RETURN explain_output;
END;
$$;
