-- Design transparency tracking (for auto bg-removal hook)
ALTER TABLE designs ADD COLUMN IF NOT EXISTS bg_removed_url TEXT;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS bg_removed_at TIMESTAMPTZ;

-- Privacy controls for personal photo designs
ALTER TABLE designs ADD COLUMN IF NOT EXISTS privacy_level VARCHAR(20)
  DEFAULT 'public'
  CHECK (privacy_level IN ('public', 'private', 'personal'));
ALTER TABLE designs ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Design lineage (for customize_design parent tracking)
ALTER TABLE designs ADD COLUMN IF NOT EXISTS parent_design_id UUID
  REFERENCES designs(id) ON DELETE SET NULL;

-- Partial index for public gallery queries (only approved + public)
CREATE INDEX IF NOT EXISTS idx_designs_gallery
  ON designs (moderation_status, privacy_level, created_at DESC)
  WHERE moderation_status = 'approved' AND privacy_level = 'public';
