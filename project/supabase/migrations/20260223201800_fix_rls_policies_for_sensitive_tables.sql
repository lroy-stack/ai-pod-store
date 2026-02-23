-- Fix RLS policies for Feature #19
-- 1. Replace USING(true) policies on messaging tables with service_role-only policies
-- 2. Add service_role-only policies to agent tables

-- Drop and recreate messaging table policies with proper service_role restriction
DROP POLICY IF EXISTS "Service role full access to telegram_messages" ON telegram_messages;
CREATE POLICY "Service role full access to telegram_messages" ON telegram_messages
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "Service role full access to whatsapp_messages" ON whatsapp_messages
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to user_messaging_links" ON user_messaging_links;
CREATE POLICY "Service role full access to user_messaging_links" ON user_messaging_links
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to messaging_conversations" ON messaging_conversations;
CREATE POLICY "Service role full access to messaging_conversations" ON messaging_conversations
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to messaging_channels" ON messaging_channels;
CREATE POLICY "Service role full access to messaging_channels" ON messaging_channels
  FOR ALL USING (auth.role() = 'service_role');

-- Add service_role-only policies to agent tables
DROP POLICY IF EXISTS "Service role full access to agent_sessions" ON agent_sessions;
CREATE POLICY "Service role full access to agent_sessions" ON agent_sessions
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to agent_events" ON agent_events;
CREATE POLICY "Service role full access to agent_events" ON agent_events
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to agent_daily_costs" ON agent_daily_costs;
CREATE POLICY "Service role full access to agent_daily_costs" ON agent_daily_costs
  FOR ALL USING (auth.role() = 'service_role');

-- Add policies for other agent-related tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agent_logs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Service role full access to agent_logs" ON agent_logs';
    EXECUTE 'CREATE POLICY "Service role full access to agent_logs" ON agent_logs
      FOR ALL USING (auth.role() = ''service_role'')';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agent_budgets') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Service role full access to agent_budgets" ON agent_budgets';
    EXECUTE 'CREATE POLICY "Service role full access to agent_budgets" ON agent_budgets
      FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;
