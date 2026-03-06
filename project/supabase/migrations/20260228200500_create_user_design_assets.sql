CREATE TABLE IF NOT EXISTS user_design_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  processed_url TEXT,
  thumbnail_url TEXT,
  filename TEXT,
  mime_type TEXT,
  file_size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  has_transparency BOOLEAN DEFAULT false,
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'ai_generation', 'chat')),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
