-- Expand theme category and shadow_preset constraints to support new themes (Feature 33-37 prep)

-- Drop the existing category constraint
ALTER TABLE store_themes DROP CONSTRAINT IF EXISTS store_themes_category_check;

-- Add new constraint with all supported categories
ALTER TABLE store_themes ADD CONSTRAINT store_themes_category_check
  CHECK (category IN (
    'light',
    'dark',
    'high_contrast',
    'custom',
    'eco',
    'tech',
    'bohemian',
    'outdoor',
    'premium',
    'fun',
    'minimal',
    'vintage'
  ));

-- Drop the existing shadow_preset constraint
ALTER TABLE store_themes DROP CONSTRAINT IF EXISTS store_themes_shadow_preset_check;

-- Add new constraint with 'subtle' added
ALTER TABLE store_themes ADD CONSTRAINT store_themes_shadow_preset_check
  CHECK (shadow_preset IN ('none', 'small', 'subtle', 'medium', 'large', 'extra_large'));

-- Comments
COMMENT ON COLUMN store_themes.category IS 'Theme category: light, dark, high_contrast, custom, eco, tech, bohemian, outdoor, premium, fun, minimal, vintage';
COMMENT ON COLUMN store_themes.shadow_preset IS 'Shadow preset: none, small, subtle, medium, large, extra_large';
