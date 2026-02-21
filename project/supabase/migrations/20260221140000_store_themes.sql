-- Create store_themes table for theme management system
CREATE TABLE IF NOT EXISTS store_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('light', 'dark', 'high_contrast', 'custom')),

  -- CSS variables for light mode (JSONB for flexibility)
  css_variables JSONB NOT NULL DEFAULT '{}',

  -- CSS variables for dark mode
  css_variables_dark JSONB NOT NULL DEFAULT '{}',

  -- Font configuration
  fonts JSONB NOT NULL DEFAULT '{
    "heading": "system-ui",
    "body": "system-ui",
    "mono": "ui-monospace"
  }',

  -- Border radius preset
  border_radius TEXT NOT NULL DEFAULT 'medium' CHECK (border_radius IN ('none', 'small', 'medium', 'large', 'full')),

  -- Shadow preset
  shadow_preset TEXT NOT NULL DEFAULT 'medium' CHECK (shadow_preset IN ('none', 'small', 'medium', 'large', 'extra_large')),

  -- Status flags
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_custom BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique index to ensure only one theme can be active at a time
CREATE UNIQUE INDEX store_themes_unique_active
  ON store_themes (is_active)
  WHERE is_active = true;

-- Create unique index to ensure only one theme can be default
CREATE UNIQUE INDEX store_themes_unique_default
  ON store_themes (is_default)
  WHERE is_default = true;

-- Create index on slug for fast lookups
CREATE INDEX store_themes_slug_idx ON store_themes (slug);

-- Create index on category for filtering
CREATE INDEX store_themes_category_idx ON store_themes (category);

-- Enable Row Level Security
ALTER TABLE store_themes ENABLE ROW LEVEL SECURITY;

-- Public read access policy (all users can view themes)
CREATE POLICY "Themes are publicly readable"
  ON store_themes
  FOR SELECT
  USING (true);

-- Only authenticated users can insert themes
CREATE POLICY "Authenticated users can insert themes"
  ON store_themes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only authenticated users can update themes
CREATE POLICY "Authenticated users can update themes"
  ON store_themes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only authenticated users can delete custom themes
CREATE POLICY "Authenticated users can delete custom themes"
  ON store_themes
  FOR DELETE
  TO authenticated
  USING (is_custom = true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_store_themes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER store_themes_updated_at
  BEFORE UPDATE ON store_themes
  FOR EACH ROW
  EXECUTE FUNCTION update_store_themes_updated_at();

-- Seed 8 default themes (as specified in app_spec.txt Section 2)
INSERT INTO store_themes (name, slug, description, category, css_variables, css_variables_dark, is_default) VALUES
(
  'Ocean Blue',
  'ocean-blue',
  'Fresh and professional blue theme with high contrast',
  'light',
  '{
    "primary": "oklch(0.55 0.20 245)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.80 0.10 245)",
    "secondary-foreground": "oklch(0.15 0.00 0)",
    "accent": "oklch(0.65 0.25 200)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.98 0.00 0)",
    "foreground": "oklch(0.15 0.00 0)",
    "card": "oklch(1.00 0.00 0)",
    "card-foreground": "oklch(0.15 0.00 0)",
    "muted": "oklch(0.92 0.00 0)",
    "muted-foreground": "oklch(0.45 0.00 0)",
    "border": "oklch(0.88 0.00 0)",
    "ring": "oklch(0.55 0.20 245)"
  }',
  '{
    "primary": "oklch(0.65 0.20 245)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.30 0.10 245)",
    "secondary-foreground": "oklch(0.98 0.00 0)",
    "accent": "oklch(0.55 0.25 200)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.12 0.00 0)",
    "foreground": "oklch(0.95 0.00 0)",
    "card": "oklch(0.18 0.00 0)",
    "card-foreground": "oklch(0.95 0.00 0)",
    "muted": "oklch(0.25 0.00 0)",
    "muted-foreground": "oklch(0.65 0.00 0)",
    "border": "oklch(0.30 0.00 0)",
    "ring": "oklch(0.65 0.20 245)"
  }',
  true
),
(
  'Forest Green',
  'forest-green',
  'Natural and calming green theme',
  'light',
  '{
    "primary": "oklch(0.50 0.15 145)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.75 0.10 145)",
    "secondary-foreground": "oklch(0.15 0.00 0)",
    "accent": "oklch(0.60 0.20 100)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.98 0.00 0)",
    "foreground": "oklch(0.15 0.00 0)",
    "card": "oklch(1.00 0.00 0)",
    "card-foreground": "oklch(0.15 0.00 0)",
    "muted": "oklch(0.92 0.00 0)",
    "muted-foreground": "oklch(0.45 0.00 0)",
    "border": "oklch(0.88 0.00 0)",
    "ring": "oklch(0.50 0.15 145)"
  }',
  '{
    "primary": "oklch(0.60 0.15 145)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.28 0.10 145)",
    "secondary-foreground": "oklch(0.98 0.00 0)",
    "accent": "oklch(0.50 0.20 100)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.12 0.00 0)",
    "foreground": "oklch(0.95 0.00 0)",
    "card": "oklch(0.18 0.00 0)",
    "card-foreground": "oklch(0.95 0.00 0)",
    "muted": "oklch(0.25 0.00 0)",
    "muted-foreground": "oklch(0.65 0.00 0)",
    "border": "oklch(0.30 0.00 0)",
    "ring": "oklch(0.60 0.15 145)"
  }',
  false
),
(
  'Sunset Orange',
  'sunset-orange',
  'Energetic and warm orange theme',
  'light',
  '{
    "primary": "oklch(0.60 0.22 35)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.80 0.12 35)",
    "secondary-foreground": "oklch(0.15 0.00 0)",
    "accent": "oklch(0.65 0.25 60)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.98 0.00 0)",
    "foreground": "oklch(0.15 0.00 0)",
    "card": "oklch(1.00 0.00 0)",
    "card-foreground": "oklch(0.15 0.00 0)",
    "muted": "oklch(0.92 0.00 0)",
    "muted-foreground": "oklch(0.45 0.00 0)",
    "border": "oklch(0.88 0.00 0)",
    "ring": "oklch(0.60 0.22 35)"
  }',
  '{
    "primary": "oklch(0.65 0.22 35)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.32 0.12 35)",
    "secondary-foreground": "oklch(0.98 0.00 0)",
    "accent": "oklch(0.55 0.25 60)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.12 0.00 0)",
    "foreground": "oklch(0.95 0.00 0)",
    "card": "oklch(0.18 0.00 0)",
    "card-foreground": "oklch(0.95 0.00 0)",
    "muted": "oklch(0.25 0.00 0)",
    "muted-foreground": "oklch(0.65 0.00 0)",
    "border": "oklch(0.30 0.00 0)",
    "ring": "oklch(0.65 0.22 35)"
  }',
  false
),
(
  'Royal Purple',
  'royal-purple',
  'Elegant and luxurious purple theme',
  'light',
  '{
    "primary": "oklch(0.50 0.20 295)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.75 0.12 295)",
    "secondary-foreground": "oklch(0.15 0.00 0)",
    "accent": "oklch(0.60 0.25 270)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.98 0.00 0)",
    "foreground": "oklch(0.15 0.00 0)",
    "card": "oklch(1.00 0.00 0)",
    "card-foreground": "oklch(0.15 0.00 0)",
    "muted": "oklch(0.92 0.00 0)",
    "muted-foreground": "oklch(0.45 0.00 0)",
    "border": "oklch(0.88 0.00 0)",
    "ring": "oklch(0.50 0.20 295)"
  }',
  '{
    "primary": "oklch(0.60 0.20 295)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.28 0.12 295)",
    "secondary-foreground": "oklch(0.98 0.00 0)",
    "accent": "oklch(0.50 0.25 270)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.12 0.00 0)",
    "foreground": "oklch(0.95 0.00 0)",
    "card": "oklch(0.18 0.00 0)",
    "card-foreground": "oklch(0.95 0.00 0)",
    "muted": "oklch(0.25 0.00 0)",
    "muted-foreground": "oklch(0.65 0.00 0)",
    "border": "oklch(0.30 0.00 0)",
    "ring": "oklch(0.60 0.20 295)"
  }',
  false
),
(
  'Slate Gray',
  'slate-gray',
  'Professional and neutral gray theme',
  'light',
  '{
    "primary": "oklch(0.40 0.00 0)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.70 0.00 0)",
    "secondary-foreground": "oklch(0.15 0.00 0)",
    "accent": "oklch(0.50 0.05 250)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.98 0.00 0)",
    "foreground": "oklch(0.15 0.00 0)",
    "card": "oklch(1.00 0.00 0)",
    "card-foreground": "oklch(0.15 0.00 0)",
    "muted": "oklch(0.92 0.00 0)",
    "muted-foreground": "oklch(0.45 0.00 0)",
    "border": "oklch(0.88 0.00 0)",
    "ring": "oklch(0.40 0.00 0)"
  }',
  '{
    "primary": "oklch(0.70 0.00 0)",
    "primary-foreground": "oklch(0.12 0.00 0)",
    "secondary": "oklch(0.30 0.00 0)",
    "secondary-foreground": "oklch(0.98 0.00 0)",
    "accent": "oklch(0.60 0.05 250)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.12 0.00 0)",
    "foreground": "oklch(0.95 0.00 0)",
    "card": "oklch(0.18 0.00 0)",
    "card-foreground": "oklch(0.95 0.00 0)",
    "muted": "oklch(0.25 0.00 0)",
    "muted-foreground": "oklch(0.65 0.00 0)",
    "border": "oklch(0.30 0.00 0)",
    "ring": "oklch(0.70 0.00 0)"
  }',
  false
),
(
  'Crimson Red',
  'crimson-red',
  'Bold and passionate red theme',
  'light',
  '{
    "primary": "oklch(0.50 0.25 15)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.75 0.15 15)",
    "secondary-foreground": "oklch(0.15 0.00 0)",
    "accent": "oklch(0.60 0.28 355)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.98 0.00 0)",
    "foreground": "oklch(0.15 0.00 0)",
    "card": "oklch(1.00 0.00 0)",
    "card-foreground": "oklch(0.15 0.00 0)",
    "muted": "oklch(0.92 0.00 0)",
    "muted-foreground": "oklch(0.45 0.00 0)",
    "border": "oklch(0.88 0.00 0)",
    "ring": "oklch(0.50 0.25 15)"
  }',
  '{
    "primary": "oklch(0.60 0.25 15)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.28 0.15 15)",
    "secondary-foreground": "oklch(0.98 0.00 0)",
    "accent": "oklch(0.50 0.28 355)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.12 0.00 0)",
    "foreground": "oklch(0.95 0.00 0)",
    "card": "oklch(0.18 0.00 0)",
    "card-foreground": "oklch(0.95 0.00 0)",
    "muted": "oklch(0.25 0.00 0)",
    "muted-foreground": "oklch(0.65 0.00 0)",
    "border": "oklch(0.30 0.00 0)",
    "ring": "oklch(0.60 0.25 15)"
  }',
  false
),
(
  'Midnight Dark',
  'midnight-dark',
  'Pure dark theme with high contrast',
  'dark',
  '{
    "primary": "oklch(0.75 0.15 240)",
    "primary-foreground": "oklch(0.12 0.00 0)",
    "secondary": "oklch(0.25 0.08 240)",
    "secondary-foreground": "oklch(0.95 0.00 0)",
    "accent": "oklch(0.65 0.20 200)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.10 0.00 0)",
    "foreground": "oklch(0.95 0.00 0)",
    "card": "oklch(0.15 0.00 0)",
    "card-foreground": "oklch(0.95 0.00 0)",
    "muted": "oklch(0.22 0.00 0)",
    "muted-foreground": "oklch(0.70 0.00 0)",
    "border": "oklch(0.28 0.00 0)",
    "ring": "oklch(0.75 0.15 240)"
  }',
  '{
    "primary": "oklch(0.70 0.15 240)",
    "primary-foreground": "oklch(0.98 0.00 0)",
    "secondary": "oklch(0.22 0.08 240)",
    "secondary-foreground": "oklch(0.98 0.00 0)",
    "accent": "oklch(0.60 0.20 200)",
    "accent-foreground": "oklch(0.98 0.00 0)",
    "background": "oklch(0.08 0.00 0)",
    "foreground": "oklch(0.98 0.00 0)",
    "card": "oklch(0.12 0.00 0)",
    "card-foreground": "oklch(0.98 0.00 0)",
    "muted": "oklch(0.18 0.00 0)",
    "muted-foreground": "oklch(0.75 0.00 0)",
    "border": "oklch(0.25 0.00 0)",
    "ring": "oklch(0.70 0.15 240)"
  }',
  false
),
(
  'High Contrast',
  'high-contrast',
  'Maximum accessibility with WCAG AAA compliance',
  'high_contrast',
  '{
    "primary": "oklch(0.20 0.00 0)",
    "primary-foreground": "oklch(1.00 0.00 0)",
    "secondary": "oklch(0.40 0.00 0)",
    "secondary-foreground": "oklch(1.00 0.00 0)",
    "accent": "oklch(0.00 0.00 0)",
    "accent-foreground": "oklch(1.00 0.00 0)",
    "background": "oklch(1.00 0.00 0)",
    "foreground": "oklch(0.00 0.00 0)",
    "card": "oklch(0.98 0.00 0)",
    "card-foreground": "oklch(0.00 0.00 0)",
    "muted": "oklch(0.90 0.00 0)",
    "muted-foreground": "oklch(0.20 0.00 0)",
    "border": "oklch(0.00 0.00 0)",
    "ring": "oklch(0.00 0.00 0)"
  }',
  '{
    "primary": "oklch(0.95 0.00 0)",
    "primary-foreground": "oklch(0.00 0.00 0)",
    "secondary": "oklch(0.75 0.00 0)",
    "secondary-foreground": "oklch(0.00 0.00 0)",
    "accent": "oklch(1.00 0.00 0)",
    "accent-foreground": "oklch(0.00 0.00 0)",
    "background": "oklch(0.00 0.00 0)",
    "foreground": "oklch(1.00 0.00 0)",
    "card": "oklch(0.08 0.00 0)",
    "card-foreground": "oklch(1.00 0.00 0)",
    "muted": "oklch(0.15 0.00 0)",
    "muted-foreground": "oklch(0.90 0.00 0)",
    "border": "oklch(1.00 0.00 0)",
    "ring": "oklch(1.00 0.00 0)"
  }',
  false
);

-- Comment on table
COMMENT ON TABLE store_themes IS 'Theme configurations for the storefront with light/dark mode support';
