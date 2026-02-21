-- Add Sunset Bohemian theme (Feature 32)

-- First, drop the existing CHECK constraint on border_radius to allow custom values like '1rem'
ALTER TABLE store_themes DROP CONSTRAINT IF EXISTS store_themes_border_radius_check;

-- Now insert the Sunset Bohemian theme with the correct values
INSERT INTO store_themes (name, slug, description, category, css_variables, css_variables_dark, fonts, border_radius, shadow_preset, is_default) VALUES
(
  'Sunset Bohemian',
  'sunset-bohemian',
  'Warm terracotta and cream tones for lifestyle, artisan, and bohemian stores',
  'light',
  '{
    "primary": "oklch(0.65 0.15 40)",
    "primary-foreground": "oklch(0.97 0.01 80)",
    "secondary": "oklch(0.93 0.02 80)",
    "secondary-foreground": "oklch(0.20 0.03 40)",
    "accent": "oklch(0.85 0.10 85)",
    "accent-foreground": "oklch(0.20 0.03 40)",
    "background": "oklch(0.97 0.01 80)",
    "foreground": "oklch(0.20 0.03 40)",
    "card": "oklch(0.98 0.008 80)",
    "card-foreground": "oklch(0.20 0.03 40)",
    "muted": "oklch(0.93 0.02 80)",
    "muted-foreground": "oklch(0.50 0.03 40)",
    "border": "oklch(0.88 0.03 80)",
    "ring": "oklch(0.65 0.15 40)"
  }',
  '{
    "primary": "oklch(0.70 0.14 40)",
    "primary-foreground": "oklch(0.18 0.02 40)",
    "secondary": "oklch(0.25 0.02 40)",
    "secondary-foreground": "oklch(0.93 0.02 80)",
    "accent": "oklch(0.35 0.05 85)",
    "accent-foreground": "oklch(0.93 0.02 80)",
    "background": "oklch(0.18 0.02 40)",
    "foreground": "oklch(0.93 0.02 80)",
    "card": "oklch(0.22 0.02 40)",
    "card-foreground": "oklch(0.93 0.02 80)",
    "muted": "oklch(0.25 0.02 40)",
    "muted-foreground": "oklch(0.65 0.02 80)",
    "border": "oklch(0.32 0.02 40)",
    "ring": "oklch(0.70 0.14 40)"
  }',
  '{
    "heading": "Playfair Display",
    "body": "Lato",
    "mono": "JetBrains Mono"
  }',
  '1rem',
  'medium',
  false
);

-- Comment
COMMENT ON COLUMN store_themes.border_radius IS 'Border radius value: can be a preset (none, small, medium, large, full) or a custom CSS value (e.g., 1rem, 0.75rem)';
