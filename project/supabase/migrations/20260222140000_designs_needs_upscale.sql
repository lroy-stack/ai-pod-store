-- Add needs_upscale flag to designs table
-- Used by transparency_hook to mark designs where ESRGAN upscale failed,
-- so QA inspector / reconcile_and_fix can re-attempt later.
ALTER TABLE designs ADD COLUMN IF NOT EXISTS needs_upscale BOOLEAN DEFAULT FALSE;
