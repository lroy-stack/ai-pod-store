-- Fix agent_sessions session_type constraint to match the 8 PodClaw agents
-- The 8 agents are: researcher, marketing, designer, newsletter, cataloger, customer_manager, seo_manager, finance

-- Drop the old constraint
ALTER TABLE agent_sessions DROP CONSTRAINT IF EXISTS agent_sessions_session_type_check;

-- Add the new constraint with all 8 agent names
ALTER TABLE agent_sessions ADD CONSTRAINT agent_sessions_session_type_check
  CHECK (session_type IN ('researcher', 'marketing', 'designer', 'newsletter', 'cataloger', 'customer_manager', 'seo_manager', 'finance'));
