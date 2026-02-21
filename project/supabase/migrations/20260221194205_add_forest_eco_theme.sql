-- Add Forest Eco theme (Feature 30)
INSERT INTO store_themes (name, slug, description, category, css_variables, css_variables_dark, fonts, border_radius, shadow_preset, is_default) VALUES
(
  'Forest Eco',
  'forest-eco',
  'Earthy and sustainable forest green theme inspired by nature',
  'light',
  '{
    "primary": "oklch(0.623 0.169 149.48)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.75 0.10 145)",
    "secondary-foreground": "oklch(0.15 0.00 0)",
    "accent": "oklch(0.60 0.20 120)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.98 0.00 0)",
    "foreground": "oklch(0.15 0.00 0)",
    "card": "oklch(1.00 0.00 0)",
    "card-foreground": "oklch(0.15 0.00 0)",
    "muted": "oklch(0.92 0.00 0)",
    "muted-foreground": "oklch(0.45 0.00 0)",
    "border": "oklch(0.88 0.00 0)",
    "ring": "oklch(0.623 0.169 149.48)"
  }',
  '{
    "primary": "oklch(0.70 0.18 149.48)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.30 0.10 145)",
    "secondary-foreground": "oklch(0.98 0.00 0)",
    "accent": "oklch(0.55 0.20 120)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.12 0.00 0)",
    "foreground": "oklch(0.95 0.00 0)",
    "card": "oklch(0.18 0.00 0)",
    "card-foreground": "oklch(0.95 0.00 0)",
    "muted": "oklch(0.25 0.00 0)",
    "muted-foreground": "oklch(0.65 0.00 0)",
    "border": "oklch(0.30 0.00 0)",
    "ring": "oklch(0.70 0.18 149.48)"
  }',
  '{
    "heading": "Outfit",
    "body": "Outfit",
    "mono": "JetBrains Mono"
  }',
  'large',
  'large',
  false
);

-- Comment
COMMENT ON COLUMN store_themes.border_radius IS 'Border radius preset: none=0, small=0.25rem, medium=0.5rem, large=1.25rem, full=9999px';
COMMENT ON COLUMN store_themes.shadow_preset IS 'Shadow preset: none, small (subtle), medium, large (dramatic), extra_large';
