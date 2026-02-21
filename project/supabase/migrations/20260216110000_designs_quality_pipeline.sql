-- Add quality pipeline fields to designs table
-- Used by PodClaw Designer agent for image quality checking and source tracking

ALTER TABLE designs ADD COLUMN IF NOT EXISTS quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 10);
ALTER TABLE designs ADD COLUMN IF NOT EXISTS quality_issues JSONB DEFAULT '[]'::JSONB;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'fal' CHECK (source_type IN ('fal', 'gemini', 'sourced'));
ALTER TABLE designs ADD COLUMN IF NOT EXISTS source_url TEXT;
