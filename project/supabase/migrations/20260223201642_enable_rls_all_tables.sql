-- Enable Row Level Security on all tables in public schema
-- Feature #19: All database tables have RLS enabled with proper policies

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE 'sql_%'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
    RAISE NOTICE 'Enabled RLS on table: %', t.tablename;
  END LOOP;
END
$$;
