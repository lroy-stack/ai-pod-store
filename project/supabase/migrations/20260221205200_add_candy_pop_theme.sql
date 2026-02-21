-- Add Candy Pop theme (Feature 35)

-- Drop the existing CHECK constraint on border_radius to allow custom values like '1.5rem'
ALTER TABLE store_themes DROP CONSTRAINT IF EXISTS store_themes_border_radius_check;

-- Insert the Candy Pop theme
INSERT INTO store_themes (name, slug, description, category, css_variables, css_variables_dark, fonts, border_radius, shadow_preset, is_default) VALUES
(
  'Candy Pop',
  'candy-pop',
  'Vibrant pink, purple, and turquoise for kids, toys, and fun stores',
  'fun',
  '{
    "primary": "oklch(0.72 0.18 350)",
    "primary-foreground": "oklch(0.98 0.008 330)",
    "secondary": "oklch(0.94 0.02 330)",
    "secondary-foreground": "oklch(0.20 0.02 300)",
    "accent": "oklch(0.60 0.20 300)",
    "accent-foreground": "oklch(0.98 0.008 330)",
    "background": "oklch(0.98 0.008 330)",
    "foreground": "oklch(0.20 0.02 300)",
    "card": "oklch(0.99 0.005 330)",
    "card-foreground": "oklch(0.20 0.02 300)",
    "muted": "oklch(0.94 0.02 330)",
    "muted-foreground": "oklch(0.50 0.02 300)",
    "border": "oklch(0.90 0.02 330)",
    "ring": "oklch(0.72 0.18 350)"
  }',
  '{
    "primary": "oklch(0.72 0.18 350)",
    "primary-foreground": "oklch(0.15 0.02 300)",
    "secondary": "oklch(0.22 0.02 300)",
    "secondary-foreground": "oklch(0.94 0.02 330)",
    "accent": "oklch(0.45 0.15 300)",
    "accent-foreground": "oklch(0.94 0.02 330)",
    "background": "oklch(0.15 0.02 300)",
    "foreground": "oklch(0.94 0.02 330)",
    "card": "oklch(0.19 0.02 300)",
    "card-foreground": "oklch(0.94 0.02 330)",
    "muted": "oklch(0.22 0.02 300)",
    "muted-foreground": "oklch(0.65 0.02 330)",
    "border": "oklch(0.30 0.02 300)",
    "ring": "oklch(0.72 0.18 350)"
  }',
  '{
    "heading": "Poppins",
    "body": "Outfit",
    "mono": "JetBrains Mono"
  }',
  '1.5rem',
  'medium',
  false
);

-- Comment
COMMENT ON COLUMN store_themes.border_radius IS 'Border radius value: can be a preset (none, small, medium, large, full) or a custom CSS value (e.g., 1rem, 0.75rem)';
