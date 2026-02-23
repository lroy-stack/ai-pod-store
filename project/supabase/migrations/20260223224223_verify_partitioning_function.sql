-- Function to verify partitioning status for feature #36
-- Returns JSON with table types and partition counts

CREATE OR REPLACE FUNCTION verify_partitioning()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH table_info AS (
    SELECT
      c.relname AS table_name,
      c.relkind AS table_kind,
      CASE
        WHEN c.relkind = 'p' THEN 'partitioned'
        WHEN c.relkind = 'r' THEN 'regular'
        ELSE 'other'
      END AS table_type
    FROM pg_class c
    WHERE c.relname IN ('agent_events', 'messages', 'audit_log')
      AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ),
  partition_info AS (
    SELECT
      pt.tablename AS partition_name,
      CASE
        WHEN pt.tablename LIKE 'agent_events_%' THEN 'agent_events'
        WHEN pt.tablename LIKE 'messages_%' THEN 'messages'
        WHEN pt.tablename LIKE 'audit_log_%' THEN 'audit_log'
      END AS parent_table
    FROM pg_tables pt
    WHERE pt.schemaname = 'public'
      AND pt.tablename LIKE '%_y2026m%'
  )
  SELECT json_build_object(
    'tables', (SELECT json_agg(table_info) FROM table_info),
    'partitions', (SELECT json_agg(partition_info) FROM partition_info),
    'partition_counts', json_build_object(
      'agent_events', (SELECT count(*) FROM partition_info WHERE parent_table = 'agent_events'),
      'messages', (SELECT count(*) FROM partition_info WHERE parent_table = 'messages'),
      'audit_log', (SELECT count(*) FROM partition_info WHERE parent_table = 'audit_log')
    ),
    'verified_at', NOW()
  ) INTO result;

  RETURN result;
END;
$$;
