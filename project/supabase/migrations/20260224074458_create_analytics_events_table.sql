-- Create analytics_events table for funnel tracking
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  properties JSONB DEFAULT '{}'::jsonb,
  page_url TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
