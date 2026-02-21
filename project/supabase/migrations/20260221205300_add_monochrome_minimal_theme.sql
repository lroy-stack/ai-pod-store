-- Add Monochrome Minimal theme (Feature 36)

-- Drop the existing CHECK constraint on border_radius to allow custom values like '0.5rem'
ALTER TABLE store_themes DROP CONSTRAINT IF EXISTS store_themes_border_radius_check;

-- Insert the Monochrome Minimal theme
INSERT INTO store_themes (name, slug, description, category, css_variables, css_variables_dark, fonts, border_radius, shadow_preset, is_default) VALUES
(
  'Monochrome Minimal',
  'monochrome-minimal',
  'Pure grayscale with a subtle accent for art galleries and minimal stores',
  'minimal',
  '{
    "primary": "oklch(0.25 0 0)",
    "primary-foreground": "oklch(0.98 0 0)",
    "secondary": "oklch(0.94 0 0)",
    "secondary-foreground": "oklch(0.15 0 0)",
    "accent": "oklch(0.55 0.05 250)",
    "accent-foreground": "oklch(0.98 0 0)",
    "background": "oklch(0.98 0 0)",
    "foreground": "oklch(0.15 0 0)",
    "card": "oklch(1.0 0 0)",
    "card-foreground": "oklch(0.15 0 0)",
    "muted": "oklch(0.94 0 0)",
    "muted-foreground": "oklch(0.50 0 0)",
    "border": "oklch(0.88 0 0)",
    "ring": "oklch(0.25 0 0)"
  }',
  '{
    "primary": "oklch(0.90 0 0)",
    "primary-foreground": "oklch(0.10 0 0)",
    "secondary": "oklch(0.18 0 0)",
    "secondary-foreground": "oklch(0.92 0 0)",
    "accent": "oklch(0.55 0.05 250)",
    "accent-foreground": "oklch(0.10 0 0)",
    "background": "oklch(0.10 0 0)",
    "foreground": "oklch(0.92 0 0)",
    "card": "oklch(0.14 0 0)",
    "card-foreground": "oklch(0.92 0 0)",
    "muted": "oklch(0.18 0 0)",
    "muted-foreground": "oklch(0.60 0 0)",
    "border": "oklch(0.25 0 0)",
    "ring": "oklch(0.90 0 0)"
  }',
  '{
    "heading": "Inter",
    "body": "Inter",
    "mono": "JetBrains Mono"
  }',
  '0.5rem',
  'none',
  false
);

-- Comment
COMMENT ON COLUMN store_themes.border_radius IS 'Border radius value: can be a preset (none, small, medium, large, full) or a custom CSS value (e.g., 1rem, 0.75rem)';
