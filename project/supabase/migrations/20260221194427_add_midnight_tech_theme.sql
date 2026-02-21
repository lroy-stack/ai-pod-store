-- Add Midnight Tech theme (Feature 31)
INSERT INTO store_themes (name, slug, description, category, css_variables, css_variables_dark, fonts, border_radius, shadow_preset, is_default) VALUES
(
  'Midnight Tech',
  'midnight-tech',
  'Modern dark tech theme with blue accents and minimal shadows',
  'dark',
  '{
    "primary": "oklch(0.65 0.20 250)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.40 0.10 250)",
    "secondary-foreground": "oklch(0.95 0.00 0)",
    "accent": "oklch(0.70 0.25 200)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.15 0.00 0)",
    "foreground": "oklch(0.95 0.00 0)",
    "card": "oklch(0.20 0.00 0)",
    "card-foreground": "oklch(0.95 0.00 0)",
    "muted": "oklch(0.25 0.00 0)",
    "muted-foreground": "oklch(0.70 0.00 0)",
    "border": "oklch(0.30 0.00 0)",
    "ring": "oklch(0.65 0.20 250)"
  }',
  '{
    "primary": "oklch(0.60 0.20 250)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.35 0.10 250)",
    "secondary-foreground": "oklch(0.98 0.00 0)",
    "accent": "oklch(0.65 0.25 200)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.10 0.00 0)",
    "foreground": "oklch(0.98 0.00 0)",
    "card": "oklch(0.15 0.00 0)",
    "card-foreground": "oklch(0.98 0.00 0)",
    "muted": "oklch(0.20 0.00 0)",
    "muted-foreground": "oklch(0.75 0.00 0)",
    "border": "oklch(0.25 0.00 0)",
    "ring": "oklch(0.60 0.20 250)"
  }',
  '{
    "heading": "Inter",
    "body": "JetBrains Mono",
    "mono": "JetBrains Mono"
  }',
  'medium',
  'small',
  false
);
