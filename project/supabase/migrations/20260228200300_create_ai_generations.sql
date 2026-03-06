CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES design_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  engineered_prompt TEXT,
  negative_prompt TEXT,
  intent TEXT CHECK (intent IN ('artistic', 'text-heavy', 'photorealistic', 'vector', 'pattern', 'quick-draft', 'general')),
  provider TEXT NOT NULL,
  image_url TEXT,
  cost_usd DECIMAL(10,4) DEFAULT 0,
  inference_ms INTEGER,
  is_refinement BOOLEAN DEFAULT false,
  parent_generation_id UUID REFERENCES ai_generations(id) ON DELETE SET NULL,
  moderation_status TEXT DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'flagged', 'rejected')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
