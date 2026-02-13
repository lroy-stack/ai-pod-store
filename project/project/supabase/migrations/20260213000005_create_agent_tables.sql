-- Migration: Create Agent Tables
-- Description: Create agent_sessions and agent_events tables for PodClaw autonomous agent
-- Date: 2026-02-13

-- =============================================
-- AGENT SESSIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_number INTEGER,
  session_type VARCHAR(20) CHECK (session_type IN ('research', 'catalog', 'customer', 'finance', 'design', 'seo')),
  status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  features_before INTEGER DEFAULT 0,
  features_after INTEGER DEFAULT 0,
  tool_calls INTEGER DEFAULT 0,
  tool_errors INTEGER DEFAULT 0,
  memory_snapshot TEXT,
  error_log TEXT
);

-- =============================================
-- AGENT EVENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS agent_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR AGENT TABLES
-- =============================================

-- Agent sessions indexes
CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_number ON agent_sessions(session_number);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_type ON agent_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_started_at ON agent_sessions(started_at DESC);

-- Agent events indexes
CREATE INDEX IF NOT EXISTS idx_agent_events_session_id ON agent_events(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_created_at ON agent_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_events_event_type ON agent_events(event_type);
