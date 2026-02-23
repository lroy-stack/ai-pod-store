-- Partition high-growth tables by month
-- Only migrate rows with valid foreign key references

-- =========================================
-- AGENT_EVENTS PARTITIONED TABLE
-- =========================================

CREATE TABLE IF NOT EXISTS agent_events_new (
  id BIGSERIAL,
  session_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS agent_events_y2026m02 PARTITION OF agent_events_new
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS agent_events_y2026m03 PARTITION OF agent_events_new
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS agent_events_y2026m04 PARTITION OF agent_events_new
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS agent_events_y2026m05 PARTITION OF agent_events_new
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX IF NOT EXISTS idx_agent_events_new_session ON agent_events_new (session_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_new_type ON agent_events_new (event_type);
CREATE INDEX IF NOT EXISTS idx_agent_events_new_created ON agent_events_new (created_at DESC);

-- =========================================
-- MESSAGES PARTITIONED TABLE
-- =========================================

CREATE TABLE IF NOT EXISTS messages_new (
  id UUID,
  conversation_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS messages_y2026m02 PARTITION OF messages_new
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS messages_y2026m03 PARTITION OF messages_new
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS messages_y2026m04 PARTITION OF messages_new
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS messages_y2026m05 PARTITION OF messages_new
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX IF NOT EXISTS idx_messages_new_conversation ON messages_new (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_new_created ON messages_new (created_at DESC);

-- =========================================
-- AUDIT_LOG PARTITIONED TABLE
-- =========================================

CREATE TABLE IF NOT EXISTS audit_log_new (
  id UUID,
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

CREATE TABLE IF NOT EXISTS audit_log_y2026m02 PARTITION OF audit_log_new
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS audit_log_y2026m03 PARTITION OF audit_log_new
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS audit_log_y2026m04 PARTITION OF audit_log_new
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS audit_log_y2026m05 PARTITION OF audit_log_new
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX IF NOT EXISTS idx_audit_log_new_actor ON audit_log_new (actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_new_resource ON audit_log_new (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_new_created ON audit_log_new (created_at DESC);

-- =========================================
-- MIGRATE DATA (ONLY VALID FK REFERENCES)
-- =========================================

-- Migrate agent_events: only rows with valid session_id references
INSERT INTO agent_events_new (id, session_id, event_type, data, created_at)
SELECT e.id, e.session_id, e.event_type, e.data, e.created_at
FROM agent_events e
INNER JOIN agent_sessions s ON e.session_id = s.id
ON CONFLICT DO NOTHING;

-- Migrate messages: only rows with valid conversation_id references
INSERT INTO messages_new (id, conversation_id, role, content, tool_calls, tool_results, tokens_used, created_at)
SELECT m.id, m.conversation_id, m.role, m.content, m.tool_calls, m.tool_results, m.tokens_used, m.created_at
FROM messages m
INNER JOIN conversations c ON m.conversation_id = c.id
ON CONFLICT DO NOTHING;

-- Migrate audit_log: no FK constraints
INSERT INTO audit_log_new (id, actor_type, actor_id, action, resource_type, resource_id, changes, metadata, created_at)
SELECT id, actor_type, actor_id, action, resource_type, resource_id, changes, metadata, created_at
FROM audit_log
ON CONFLICT DO NOTHING;

-- =========================================
-- SWAP TABLES
-- =========================================

DROP TABLE IF EXISTS agent_events CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;

ALTER TABLE agent_events_new RENAME TO agent_events;
ALTER TABLE messages_new RENAME TO messages;
ALTER TABLE audit_log_new RENAME TO audit_log;

ALTER INDEX idx_agent_events_new_session RENAME TO idx_agent_events_session;
ALTER INDEX idx_agent_events_new_type RENAME TO idx_agent_events_type;
ALTER INDEX idx_agent_events_new_created RENAME TO idx_agent_events_created;
ALTER INDEX idx_messages_new_conversation RENAME TO idx_messages_conversation;
ALTER INDEX idx_messages_new_created RENAME TO idx_messages_created;
ALTER INDEX idx_audit_log_new_actor RENAME TO idx_audit_log_actor;
ALTER INDEX idx_audit_log_new_resource RENAME TO idx_audit_log_resource;
ALTER INDEX idx_audit_log_new_created RENAME TO idx_audit_log_created;

-- =========================================
-- RECREATE FOREIGN KEY CONSTRAINTS
-- =========================================

ALTER TABLE agent_events ADD CONSTRAINT agent_events_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE;

ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
