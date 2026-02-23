-- Cleanup: Drop orphan partitioned tables created by 20260223215520
-- These tables were never populated — the swap migration was abandoned
-- due to NULL session_id conflicts.

-- Drop indexes first (on partitioned parent tables)
DROP INDEX IF EXISTS idx_agent_events_part_session;
DROP INDEX IF EXISTS idx_agent_events_part_created_at;
DROP INDEX IF EXISTS idx_agent_events_part_event_type;
DROP INDEX IF EXISTS idx_messages_part_conversation_id;
DROP INDEX IF EXISTS idx_messages_part_created_at;
DROP INDEX IF EXISTS idx_audit_log_part_actor;
DROP INDEX IF EXISTS idx_audit_log_part_resource;
DROP INDEX IF EXISTS idx_audit_log_part_created_at;

-- Drop partitioned parent tables (CASCADE drops child partitions automatically)
DROP TABLE IF EXISTS agent_events_partitioned CASCADE;
DROP TABLE IF EXISTS messages_partitioned CASCADE;
DROP TABLE IF EXISTS audit_log_partitioned CASCADE;
