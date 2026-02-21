-- Add Ocean Breeze theme (Feature 33)

-- Drop the existing CHECK constraint on border_radius to allow custom values like '0.75rem'
ALTER TABLE store_themes DROP CONSTRAINT IF EXISTS store_themes_border_radius_check;

-- Insert the Ocean Breeze theme
INSERT INTO store_themes (name, slug, description, category, css_variables, css_variables_dark, fonts, border_radius, shadow_preset, is_default) VALUES
(
  'Ocean Breeze',
  'ocean-breeze',
  'Cool ocean blues and turquoise for surf, beach, and outdoor stores',
  'outdoor',
  '{
    "primary": "oklch(0.55 0.15 230)",
    "primary-foreground": "oklch(0.98 0.005 220)",
    "secondary": "oklch(0.94 0.01 220)",
    "secondary-foreground": "oklch(0.18 0.02 230)",
    "accent": "oklch(0.75 0.12 190)",
    "accent-foreground": "oklch(0.18 0.02 230)",
    "background": "oklch(0.98 0.005 220)",
    "foreground": "oklch(0.18 0.02 230)",
    "card": "oklch(0.99 0.003 220)",
    "card-foreground": "oklch(0.18 0.02 230)",
    "muted": "oklch(0.94 0.01 220)",
    "muted-foreground": "oklch(0.50 0.02 230)",
    "border": "oklch(0.88 0.02 220)",
    "ring": "oklch(0.55 0.15 230)"
  }',
  '{
    "primary": "oklch(0.60 0.14 230)",
    "primary-foreground": "oklch(0.14 0.02 230)",
    "secondary": "oklch(0.22 0.02 230)",
    "secondary-foreground": "oklch(0.94 0.01 220)",
    "accent": "oklch(0.40 0.08 190)",
    "accent-foreground": "oklch(0.94 0.01 220)",
    "background": "oklch(0.14 0.02 230)",
    "foreground": "oklch(0.94 0.01 220)",
    "card": "oklch(0.18 0.02 230)",
    "card-foreground": "oklch(0.94 0.01 220)",
    "muted": "oklch(0.22 0.02 230)",
    "muted-foreground": "oklch(0.65 0.01 220)",
    "border": "oklch(0.30 0.02 230)",
    "ring": "oklch(0.60 0.14 230)"
  }',
  '{
    "heading": "Poppins",
    "body": "Poppins",
    "mono": "JetBrains Mono"
  }',
  '0.75rem',
  'subtle',
  false
);

-- Comment
COMMENT ON COLUMN store_themes.border_radius IS 'Border radius value: can be a preset (none, small, medium, large, full) or a custom CSS value (e.g., 1rem, 0.75rem)';
