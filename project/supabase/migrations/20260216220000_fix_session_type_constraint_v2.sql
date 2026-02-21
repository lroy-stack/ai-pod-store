-- Fix agent_sessions session_type constraint to include ALL session types:
-- 9 agents + heartbeat + consolidation
-- Previously missing: qa_inspector, heartbeat, consolidation

ALTER TABLE agent_sessions DROP CONSTRAINT IF EXISTS agent_sessions_session_type_check;

ALTER TABLE agent_sessions ADD CONSTRAINT agent_sessions_session_type_check
  CHECK (session_type IN (
    'researcher', 'marketing', 'designer', 'newsletter',
    'cataloger', 'customer_manager', 'seo_manager', 'finance',
    'qa_inspector', 'heartbeat', 'consolidation'
  ));
