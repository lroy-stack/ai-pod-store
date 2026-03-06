CREATE INDEX IF NOT EXISTS idx_design_sessions_user ON design_sessions(user_id, created_at DESC);
