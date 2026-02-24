-- Enable RLS and create policies for analytics_events table
DO $$
BEGIN
  -- Enable RLS if not already enabled
  ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

  -- Create INSERT policy for anonymous tracking
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'analytics_events'
    AND policyname = 'Anyone can insert analytics events'
  ) THEN
    CREATE POLICY "Anyone can insert analytics events"
      ON analytics_events FOR INSERT
      WITH CHECK (true);
  END IF;

  -- Create SELECT policy for service role
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'analytics_events'
    AND policyname = 'Service role can read all analytics events'
  ) THEN
    CREATE POLICY "Service role can read all analytics events"
      ON analytics_events FOR SELECT
      USING (auth.jwt()->>'role' = 'service_role');
  END IF;

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
  CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
END $$;
