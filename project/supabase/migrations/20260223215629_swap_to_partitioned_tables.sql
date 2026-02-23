-- ABANDONED: Partition swap canceled — original tables had NULL session_ids
-- that conflict with partitioned schema (NOT NULL constraint).
-- The orphan partitioned tables are cleaned up in the next migration.
-- See: 20260223215719_fix_partitioned_tables_nullable_session.sql
SELECT 1;
