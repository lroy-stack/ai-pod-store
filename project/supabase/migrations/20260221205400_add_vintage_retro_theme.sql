-- Add Vintage Retro theme (Feature 37)

-- Drop the existing CHECK constraint on border_radius to allow custom values like '0rem'
ALTER TABLE store_themes DROP CONSTRAINT IF EXISTS store_themes_border_radius_check;

-- Insert the Vintage Retro theme
INSERT INTO store_themes (name, slug, description, category, css_variables, css_variables_dark, fonts, border_radius, shadow_preset, is_default) VALUES
(
  'Vintage Retro',
  'vintage-retro',
  'Sepia, mustard, and olive tones for vintage, retro, and nostalgic stores',
  'vintage',
  '{
    "primary": "oklch(0.55 0.10 130)",
    "primary-foreground": "oklch(0.96 0.02 70)",
    "secondary": "oklch(0.92 0.03 70)",
    "secondary-foreground": "oklch(0.22 0.03 70)",
    "accent": "oklch(0.75 0.14 90)",
    "accent-foreground": "oklch(0.22 0.03 70)",
    "background": "oklch(0.96 0.02 70)",
    "foreground": "oklch(0.22 0.03 70)",
    "card": "oklch(0.97 0.015 70)",
    "card-foreground": "oklch(0.22 0.03 70)",
    "muted": "oklch(0.92 0.03 70)",
    "muted-foreground": "oklch(0.50 0.03 70)",
    "border": "oklch(0.85 0.04 70)",
    "ring": "oklch(0.55 0.10 130)"
  }',
  '{
    "primary": "oklch(0.60 0.10 130)",
    "primary-foreground": "oklch(0.16 0.02 70)",
    "secondary": "oklch(0.24 0.02 70)",
    "secondary-foreground": "oklch(0.92 0.02 70)",
    "accent": "oklch(0.40 0.08 90)",
    "accent-foreground": "oklch(0.92 0.02 70)",
    "background": "oklch(0.16 0.02 70)",
    "foreground": "oklch(0.92 0.02 70)",
    "card": "oklch(0.20 0.02 70)",
    "card-foreground": "oklch(0.92 0.02 70)",
    "muted": "oklch(0.24 0.02 70)",
    "muted-foreground": "oklch(0.65 0.02 70)",
    "border": "oklch(0.32 0.02 70)",
    "ring": "oklch(0.60 0.10 130)"
  }',
  '{
    "heading": "Merriweather",
    "body": "Roboto",
    "mono": "JetBrains Mono"
  }',
  '0rem',
  'medium',
  false
);

-- Comment
COMMENT ON COLUMN store_themes.border_radius IS 'Border radius value: can be a preset (none, small, medium, large, full) or a custom CSS value (e.g., 1rem, 0.75rem)';
