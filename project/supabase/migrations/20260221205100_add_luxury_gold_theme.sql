-- Add Luxury Gold theme (Feature 34)

-- Drop the existing CHECK constraint on border_radius to allow custom values like '0.25rem'
ALTER TABLE store_themes DROP CONSTRAINT IF EXISTS store_themes_border_radius_check;

-- Insert the Luxury Gold theme
INSERT INTO store_themes (name, slug, description, category, css_variables, css_variables_dark, fonts, border_radius, shadow_preset, is_default) VALUES
(
  'Luxury Gold',
  'luxury-gold',
  'Elegant black and gold for premium and high-end luxury stores',
  'premium',
  '{
    "primary": "oklch(0.75 0.12 85)",
    "primary-foreground": "oklch(0.15 0.01 90)",
    "secondary": "oklch(0.93 0.008 90)",
    "secondary-foreground": "oklch(0.15 0.01 90)",
    "accent": "oklch(0.88 0.06 85)",
    "accent-foreground": "oklch(0.15 0.01 90)",
    "background": "oklch(0.97 0.005 90)",
    "foreground": "oklch(0.15 0.01 90)",
    "card": "oklch(0.99 0.003 90)",
    "card-foreground": "oklch(0.15 0.01 90)",
    "muted": "oklch(0.93 0.008 90)",
    "muted-foreground": "oklch(0.50 0.01 90)",
    "border": "oklch(0.85 0.02 90)",
    "ring": "oklch(0.75 0.12 85)"
  }',
  '{
    "primary": "oklch(0.75 0.12 85)",
    "primary-foreground": "oklch(0.10 0.005 90)",
    "secondary": "oklch(0.18 0.005 90)",
    "secondary-foreground": "oklch(0.96 0.01 90)",
    "accent": "oklch(0.30 0.05 85)",
    "accent-foreground": "oklch(0.96 0.01 90)",
    "background": "oklch(0.10 0.005 90)",
    "foreground": "oklch(0.96 0.01 90)",
    "card": "oklch(0.14 0.005 90)",
    "card-foreground": "oklch(0.96 0.01 90)",
    "muted": "oklch(0.18 0.005 90)",
    "muted-foreground": "oklch(0.65 0.008 90)",
    "border": "oklch(0.28 0.01 90)",
    "ring": "oklch(0.75 0.12 85)"
  }',
  '{
    "heading": "Playfair Display",
    "body": "Montserrat",
    "mono": "JetBrains Mono"
  }',
  '0.25rem',
  'none',
  false
);

-- Comment
COMMENT ON COLUMN store_themes.border_radius IS 'Border radius value: can be a preset (none, small, medium, large, full) or a custom CSS value (e.g., 1rem, 0.75rem)';
