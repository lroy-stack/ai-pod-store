-- Partition high-growth tables by month for better performance
-- Tables: agent_events, messages, audit_log
-- Partitioning by created_at (monthly range partitions)

-- ==========================
-- 1. PARTITION AGENT_EVENTS
-- ==========================

-- Create partitioned parent table
CREATE TABLE IF NOT EXISTS agent_events_partitioned (
  id BIGSERIAL,
  session_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (3 months: Feb, Mar, Apr 2026)
CREATE TABLE IF NOT EXISTS agent_events_y2026m02 PARTITION OF agent_events_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS agent_events_y2026m03 PARTITION OF agent_events_partitioned
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS agent_events_y2026m04 PARTITION OF agent_events_partitioned
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- ==========================
-- 2. PARTITION MESSAGES
-- ==========================

-- Create partitioned parent table
CREATE TABLE IF NOT EXISTS messages_partitioned (
  id UUID DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE IF NOT EXISTS messages_y2026m02 PARTITION OF messages_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS messages_y2026m03 PARTITION OF messages_partitioned
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS messages_y2026m04 PARTITION OF messages_partitioned
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- ==========================
-- 3. PARTITION AUDIT_LOG
-- ==========================

-- Create partitioned parent table
CREATE TABLE IF NOT EXISTS audit_log_partitioned (
  id UUID DEFAULT gen_random_uuid(),
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('admin', 'ai_agent', 'system', 'webhook')),
  actor_id VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  changes JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE IF NOT EXISTS audit_log_y2026m02 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS audit_log_y2026m03 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS audit_log_y2026m04 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- ==========================
-- 4. MIGRATE DATA AND SWAP TABLES
-- ==========================

-- Note: This migration creates the partitioned structure.
-- Data migration and table swapping will happen in a separate migration
-- to avoid a single transaction timeout on large datasets.

-- The swap process would be:
-- 1. Copy data from original tables to partitioned tables
-- 2. Drop original tables (after backing up)
-- 3. Rename partitioned tables to original names
-- 4. Recreate indexes and foreign keys

-- ==========================
-- 5. CREATE INDEXES ON PARTITIONED TABLES
-- ==========================

-- Agent events indexes
CREATE INDEX IF NOT EXISTS idx_agent_events_part_session ON agent_events_partitioned (session_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_part_created_at ON agent_events_partitioned (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_events_part_event_type ON agent_events_partitioned (event_type);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_part_conversation_id ON messages_partitioned (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_part_created_at ON messages_partitioned (created_at DESC);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_part_actor ON audit_log_partitioned (actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_part_resource ON audit_log_partitioned (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_part_created_at ON audit_log_partitioned (created_at DESC);
