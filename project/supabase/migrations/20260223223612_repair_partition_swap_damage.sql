-- Repair damage from partition swap (20260223222141_partition_tables_valid_fk_only.sql)
-- DROP TABLE ... CASCADE destroyed: RLS, policies, defaults, agent_name column, indexes
-- This migration restores everything that was lost.

-- =========================================
-- 1. RESTORE LOST COLUMN: agent_events.agent_name
-- (Added in 20260214220000_podclaw_tables.sql, lost during swap)
-- =========================================
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS agent_name VARCHAR(50);

-- =========================================
-- 2. FIX session_id NULLABILITY (was made nullable in 20260214220000, swap reverted to NOT NULL)
-- =========================================
ALTER TABLE agent_events ALTER COLUMN session_id DROP NOT NULL;

-- =========================================
-- 3. RESTORE DEFAULT gen_random_uuid() ON UUID PRIMARY KEYS
-- (Original tables had DEFAULT, partitioned versions lost it)
-- =========================================
ALTER TABLE messages ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE audit_log ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- =========================================
-- 4. RE-ENABLE ROW LEVEL SECURITY
-- (Tables were dropped and recreated AFTER the RLS enable migration)
-- =========================================
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 5. RECREATE RLS POLICIES (lost during CASCADE)
-- =========================================
DROP POLICY IF EXISTS "Service role full access to agent_events" ON agent_events;
CREATE POLICY "Service role full access to agent_events"
  ON agent_events FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_messages" ON messages;
CREATE POLICY "service_role_messages"
  ON messages FOR ALL
  USING (auth.role() = 'service_role');

-- audit_log never had a policy — add one for consistency
DROP POLICY IF EXISTS "service_role_audit_log" ON audit_log;
CREATE POLICY "service_role_audit_log"
  ON audit_log FOR ALL
  USING (auth.role() = 'service_role');

-- =========================================
-- 6. RECREATE LOST COMPOUND INDEXES
-- (Created in 20260223214742, lost when tables were dropped)
-- =========================================
CREATE INDEX IF NOT EXISTS idx_agent_events_agent_name ON agent_events(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_events_agent_created ON agent_events(agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_actor ON audit_log(created_at DESC, actor_type, actor_id);

-- =========================================
-- 7. CREATE FUTURE PARTITIONS (Jun-Aug 2026)
-- (Original only had Feb-May 2026, inserts after Jun 1 would fail)
-- =========================================
CREATE TABLE IF NOT EXISTS agent_events_y2026m06 PARTITION OF agent_events FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS agent_events_y2026m07 PARTITION OF agent_events FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS agent_events_y2026m08 PARTITION OF agent_events FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS messages_y2026m06 PARTITION OF messages FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS messages_y2026m07 PARTITION OF messages FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS messages_y2026m08 PARTITION OF messages FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS audit_log_y2026m06 PARTITION OF audit_log FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026m07 PARTITION OF audit_log FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026m08 PARTITION OF audit_log FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
