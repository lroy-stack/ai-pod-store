-- Add 'subtle' to shadow_preset constraint (needed for Theme 4 Ocean Breeze)

-- Drop the existing shadow_preset constraint
ALTER TABLE store_themes DROP CONSTRAINT IF EXISTS store_themes_shadow_preset_check;

-- Add new constraint with 'subtle' added
ALTER TABLE store_themes ADD CONSTRAINT store_themes_shadow_preset_check
  CHECK (shadow_preset IN ('none', 'small', 'subtle', 'medium', 'large', 'extra_large'));

-- Comment
COMMENT ON COLUMN store_themes.shadow_preset IS 'Shadow preset: none, small, subtle, medium, large, extra_large';
