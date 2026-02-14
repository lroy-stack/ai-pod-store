-- PodClaw agent tables evolution
-- Adds agent_name column, relaxes FK, creates agent_daily_costs

-- 1. Add agent_name column to agent_events (PodClaw records agent name per event)
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS agent_name VARCHAR(50);

-- 2. Make session_id nullable (PodClaw records some events outside sessions)
ALTER TABLE agent_events ALTER COLUMN session_id DROP NOT NULL;

-- 3. Drop FK constraint so PodClaw can use its own session UUIDs
ALTER TABLE agent_events DROP CONSTRAINT IF EXISTS agent_events_session_id_fkey;

-- 4. Change id from BIGSERIAL to support UUID if PodClaw sends one
-- (Keep BIGSERIAL as default, PodClaw should omit id to let DB auto-generate)

-- 5. Add index on agent_name for PodClaw queries
CREATE INDEX IF NOT EXISTS idx_agent_events_agent_name ON agent_events (agent_name);

-- 6. Create agent_daily_costs table for cost tracking persistence
CREATE TABLE IF NOT EXISTS agent_daily_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  total_cost NUMERIC(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_name, date)
);
CREATE INDEX IF NOT EXISTS idx_agent_daily_costs_lookup ON agent_daily_costs(agent_name, date);

-- 7. Update agent_sessions type constraint to include all 8 PodClaw agents
ALTER TABLE agent_sessions DROP CONSTRAINT IF EXISTS agent_sessions_session_type_check;
ALTER TABLE agent_sessions ADD CONSTRAINT agent_sessions_session_type_check
  CHECK (session_type IN (
    'research', 'catalog', 'customer', 'finance', 'design', 'seo',
    'researcher', 'marketing', 'designer', 'newsletter',
    'cataloger', 'customer_manager', 'seo_manager'
  ));
