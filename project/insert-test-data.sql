-- Insert test agent sessions
INSERT INTO agent_sessions (session_type, status, started_at, ended_at, tool_calls, tool_errors)
VALUES
  ('cataloger', 'completed', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes', 25, 1),
  ('cataloger', 'completed', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '90 minutes', 30, 0),
  ('designer', 'completed', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '150 minutes', 15, 2),
  ('seo_manager', 'error', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '210 minutes', 10, 5),
  ('customer_manager', 'completed', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '270 minutes', 20, 0);

-- Insert test daily costs for last 7 days
INSERT INTO agent_daily_costs (agent_name, date, total_cost)
VALUES
  ('cataloger', CURRENT_DATE, 0.1234),
  ('cataloger', CURRENT_DATE - 1, 0.0987),
  ('cataloger', CURRENT_DATE - 2, 0.1456),
  ('cataloger', CURRENT_DATE - 3, 0.0723),
  ('cataloger', CURRENT_DATE - 4, 0.1098),
  ('cataloger', CURRENT_DATE - 5, 0.0567),
  ('cataloger', CURRENT_DATE - 6, 0.0834),
  ('designer', CURRENT_DATE, 0.2145),
  ('designer', CURRENT_DATE - 1, 0.1876),
  ('designer', CURRENT_DATE - 2, 0.2301),
  ('designer', CURRENT_DATE - 3, 0.1654),
  ('designer', CURRENT_DATE - 4, 0.1923),
  ('designer', CURRENT_DATE - 5, 0.1432),
  ('designer', CURRENT_DATE - 6, 0.1765),
  ('seo_manager', CURRENT_DATE, 0.0543),
  ('seo_manager', CURRENT_DATE - 1, 0.0689),
  ('seo_manager', CURRENT_DATE - 2, 0.0412),
  ('seo_manager', CURRENT_DATE - 3, 0.0756),
  ('seo_manager', CURRENT_DATE - 4, 0.0523),
  ('seo_manager', CURRENT_DATE - 5, 0.0678),
  ('seo_manager', CURRENT_DATE - 6, 0.0445),
  ('customer_manager', CURRENT_DATE, 0.0321),
  ('customer_manager', CURRENT_DATE - 1, 0.0456),
  ('customer_manager', CURRENT_DATE - 2, 0.0289),
  ('customer_manager', CURRENT_DATE - 3, 0.0512),
  ('customer_manager', CURRENT_DATE - 4, 0.0367),
  ('customer_manager', CURRENT_DATE - 5, 0.0434),
  ('customer_manager', CURRENT_DATE - 6, 0.0298)
ON CONFLICT (agent_name, date) DO UPDATE
  SET total_cost = EXCLUDED.total_cost,
      updated_at = NOW();
