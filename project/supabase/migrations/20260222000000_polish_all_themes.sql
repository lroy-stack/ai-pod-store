-- ============================================================================
-- Migration: Polish & Consolidate Theme System (16 → 11 themes)
-- ============================================================================
-- 1. DELETE 5 clone/conflicting themes
-- 2. UPDATE 11 remaining themes with complete design systems:
--    - Unique typography per theme
--    - Tinted surfaces (not generic grays)
--    - Extended variables: destructive, success, warning, input, popover,
--      rating, chart-1..5
--    - Consistent radius + shadow presets
-- ============================================================================

BEGIN;

-- ─── Phase 1: Delete clone themes ──────────────────────────────────────────

-- If any deleted theme was active, reset to default (ocean-blue)
UPDATE store_themes SET is_active = true
WHERE slug = 'ocean-blue'
  AND EXISTS (
    SELECT 1 FROM store_themes
    WHERE slug IN ('forest-green', 'sunset-orange', 'slate-gray', 'crimson-red', 'midnight-dark')
      AND is_active = true
  );

-- Now safe to delete — deactivate first to avoid unique constraint issues
UPDATE store_themes SET is_active = false
WHERE slug IN ('forest-green', 'sunset-orange', 'slate-gray', 'crimson-red', 'midnight-dark');

DELETE FROM store_themes
WHERE slug IN (
  'forest-green',    -- clone of seed, system-ui, absorbed by forest-eco
  'sunset-orange',   -- clone of seed, system-ui, absorbed by sunset-bohemian
  'slate-gray',      -- clone of seed, system-ui, absorbed by monochrome-minimal
  'crimson-red',     -- red primary conflicts with destructive semantic
  'midnight-dark'    -- near-identical to midnight-tech, no fonts
);

-- ─── Phase 2: Update all 11 themes with complete design systems ────────────

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 1. OCEAN BLUE — "Profesional Limpio" (DEFAULT)                        │
-- │    Inter / Inter / JetBrains Mono · medium radius · subtle shadow      │
-- └─────────────────────────────────────────────────────────────────────────┘
UPDATE store_themes SET
  name = 'Ocean Blue',
  description = 'Professional and clean — corporate trust, Apple-like blues, cool neutral surfaces',
  category = 'light',
  fonts = '{"heading": "Inter", "body": "Inter", "mono": "JetBrains Mono"}'::jsonb,
  border_radius = '0.75rem',
  shadow_preset = 'subtle',
  css_variables = '{
    "background": "oklch(0.985 0.003 245)",
    "foreground": "oklch(0.15 0.01 245)",
    "card": "oklch(1.0 0 0)",
    "card-foreground": "oklch(0.15 0.01 245)",
    "popover": "oklch(1.0 0 0)",
    "popover-foreground": "oklch(0.15 0.01 245)",
    "primary": "oklch(0.55 0.20 245)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.96 0.005 245)",
    "secondary-foreground": "oklch(0.15 0.01 245)",
    "muted": "oklch(0.955 0.008 245)",
    "muted-foreground": "oklch(0.55 0.02 245)",
    "accent": "oklch(0.65 0.15 200)",
    "accent-foreground": "oklch(1.0 0 0)",
    "destructive": "oklch(0.55 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.60 0.18 145)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.75 0.16 70)",
    "warning-foreground": "oklch(0.25 0.05 70)",
    "border": "oklch(0.90 0.005 245)",
    "input": "oklch(0.96 0.005 245)",
    "ring": "oklch(0.55 0.20 245)",
    "rating": "oklch(0.80 0.16 85)",
    "rating-foreground": "oklch(0.40 0.08 85)",
    "chart-1": "oklch(0.55 0.20 245)",
    "chart-2": "oklch(0.55 0.18 280)",
    "chart-3": "oklch(0.65 0.15 200)",
    "chart-4": "oklch(0.60 0.18 145)",
    "chart-5": "oklch(0.75 0.16 70)"
  }'::jsonb,
  css_variables_dark = '{
    "background": "oklch(0.13 0.005 245)",
    "foreground": "oklch(0.95 0.005 245)",
    "card": "oklch(0.18 0.008 245)",
    "card-foreground": "oklch(0.95 0.005 245)",
    "popover": "oklch(0.18 0.008 245)",
    "popover-foreground": "oklch(0.95 0.005 245)",
    "primary": "oklch(0.65 0.20 245)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.20 0.008 245)",
    "secondary-foreground": "oklch(0.95 0.005 245)",
    "muted": "oklch(0.22 0.01 245)",
    "muted-foreground": "oklch(0.65 0.015 245)",
    "accent": "oklch(0.55 0.15 200)",
    "accent-foreground": "oklch(1.0 0 0)",
    "destructive": "oklch(0.60 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.65 0.18 145)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.78 0.16 70)",
    "warning-foreground": "oklch(0.20 0.05 70)",
    "border": "oklch(0.25 0.01 245)",
    "input": "oklch(0.20 0.008 245)",
    "ring": "oklch(0.65 0.20 245)",
    "rating": "oklch(0.80 0.16 85)",
    "rating-foreground": "oklch(0.40 0.08 85)",
    "chart-1": "oklch(0.65 0.20 245)",
    "chart-2": "oklch(0.60 0.18 280)",
    "chart-3": "oklch(0.70 0.15 200)",
    "chart-4": "oklch(0.65 0.18 145)",
    "chart-5": "oklch(0.78 0.16 70)"
  }'::jsonb,
  is_default = true,
  is_active = CASE WHEN is_active THEN true ELSE is_active END,
  updated_at = now()
WHERE slug = 'ocean-blue';

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 2. FOREST ECO — "Naturaleza Orgánica"                                 │
-- │    Outfit / Outfit / JetBrains Mono · large radius · subtle shadow     │
-- └─────────────────────────────────────────────────────────────────────────┘
UPDATE store_themes SET
  name = 'Forest Eco',
  description = 'Eco-friendly organic feel — forest greens, rounded shapes, natural warmth',
  category = 'eco',
  fonts = '{"heading": "Outfit", "body": "Outfit", "mono": "JetBrains Mono"}'::jsonb,
  border_radius = '1rem',
  shadow_preset = 'subtle',
  css_variables = '{
    "background": "oklch(0.98 0.008 145)",
    "foreground": "oklch(0.18 0.03 145)",
    "card": "oklch(0.995 0.005 145)",
    "card-foreground": "oklch(0.18 0.03 145)",
    "popover": "oklch(0.995 0.005 145)",
    "popover-foreground": "oklch(0.18 0.03 145)",
    "primary": "oklch(0.55 0.17 150)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.955 0.012 145)",
    "secondary-foreground": "oklch(0.18 0.03 145)",
    "muted": "oklch(0.94 0.015 145)",
    "muted-foreground": "oklch(0.50 0.03 145)",
    "accent": "oklch(0.65 0.15 100)",
    "accent-foreground": "oklch(0.18 0.03 145)",
    "destructive": "oklch(0.55 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.60 0.20 150)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.78 0.14 80)",
    "warning-foreground": "oklch(0.30 0.06 80)",
    "border": "oklch(0.90 0.012 145)",
    "input": "oklch(0.955 0.012 145)",
    "ring": "oklch(0.55 0.17 150)",
    "rating": "oklch(0.80 0.14 85)",
    "rating-foreground": "oklch(0.40 0.08 85)",
    "chart-1": "oklch(0.55 0.17 150)",
    "chart-2": "oklch(0.65 0.15 100)",
    "chart-3": "oklch(0.70 0.12 130)",
    "chart-4": "oklch(0.78 0.14 80)",
    "chart-5": "oklch(0.60 0.10 170)"
  }'::jsonb,
  css_variables_dark = '{
    "background": "oklch(0.14 0.01 145)",
    "foreground": "oklch(0.93 0.01 145)",
    "card": "oklch(0.19 0.015 145)",
    "card-foreground": "oklch(0.93 0.01 145)",
    "popover": "oklch(0.19 0.015 145)",
    "popover-foreground": "oklch(0.93 0.01 145)",
    "primary": "oklch(0.65 0.17 150)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.22 0.015 145)",
    "secondary-foreground": "oklch(0.93 0.01 145)",
    "muted": "oklch(0.24 0.018 145)",
    "muted-foreground": "oklch(0.62 0.02 145)",
    "accent": "oklch(0.55 0.15 100)",
    "accent-foreground": "oklch(0.93 0.01 145)",
    "destructive": "oklch(0.60 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.65 0.20 150)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.80 0.14 80)",
    "warning-foreground": "oklch(0.20 0.06 80)",
    "border": "oklch(0.28 0.018 145)",
    "input": "oklch(0.22 0.015 145)",
    "ring": "oklch(0.65 0.17 150)",
    "rating": "oklch(0.80 0.14 85)",
    "rating-foreground": "oklch(0.40 0.08 85)",
    "chart-1": "oklch(0.65 0.17 150)",
    "chart-2": "oklch(0.70 0.15 100)",
    "chart-3": "oklch(0.75 0.12 130)",
    "chart-4": "oklch(0.80 0.14 80)",
    "chart-5": "oklch(0.65 0.10 170)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'forest-eco';

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 3. MIDNIGHT TECH — "Terminal Futurista"                               │
-- │    Inter / JetBrains Mono / JetBrains Mono · small radius · no shadow  │
-- └─────────────────────────────────────────────────────────────────────────┘
UPDATE store_themes SET
  name = 'Midnight Tech',
  description = 'Hacker aesthetic — sharp edges, neon cyan on deep black, terminal vibes',
  category = 'dark',
  fonts = '{"heading": "Inter", "body": "JetBrains Mono", "mono": "JetBrains Mono"}'::jsonb,
  border_radius = '0.375rem',
  shadow_preset = 'none',
  css_variables = '{
    "background": "oklch(0.96 0.005 250)",
    "foreground": "oklch(0.15 0.01 250)",
    "card": "oklch(0.99 0.003 250)",
    "card-foreground": "oklch(0.15 0.01 250)",
    "popover": "oklch(0.99 0.003 250)",
    "popover-foreground": "oklch(0.15 0.01 250)",
    "primary": "oklch(0.55 0.18 200)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.93 0.008 250)",
    "secondary-foreground": "oklch(0.15 0.01 250)",
    "muted": "oklch(0.93 0.008 250)",
    "muted-foreground": "oklch(0.50 0.015 250)",
    "accent": "oklch(0.60 0.20 280)",
    "accent-foreground": "oklch(1.0 0 0)",
    "destructive": "oklch(0.55 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.65 0.18 160)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.78 0.16 70)",
    "warning-foreground": "oklch(0.25 0.05 70)",
    "border": "oklch(0.88 0.005 250)",
    "input": "oklch(0.93 0.008 250)",
    "ring": "oklch(0.55 0.18 200)",
    "rating": "oklch(0.80 0.16 85)",
    "rating-foreground": "oklch(0.40 0.08 85)",
    "chart-1": "oklch(0.55 0.18 200)",
    "chart-2": "oklch(0.60 0.20 280)",
    "chart-3": "oklch(0.65 0.22 340)",
    "chart-4": "oklch(0.65 0.18 160)",
    "chart-5": "oklch(0.70 0.15 230)"
  }'::jsonb,
  css_variables_dark = '{
    "background": "oklch(0.10 0.01 250)",
    "foreground": "oklch(0.92 0.005 250)",
    "card": "oklch(0.15 0.01 250)",
    "card-foreground": "oklch(0.92 0.005 250)",
    "popover": "oklch(0.15 0.01 250)",
    "popover-foreground": "oklch(0.92 0.005 250)",
    "primary": "oklch(0.70 0.18 200)",
    "primary-foreground": "oklch(0.10 0.01 250)",
    "secondary": "oklch(0.18 0.012 250)",
    "secondary-foreground": "oklch(0.92 0.005 250)",
    "muted": "oklch(0.20 0.015 250)",
    "muted-foreground": "oklch(0.60 0.01 250)",
    "accent": "oklch(0.75 0.20 280)",
    "accent-foreground": "oklch(0.10 0.01 250)",
    "destructive": "oklch(0.60 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.70 0.18 160)",
    "success-foreground": "oklch(0.10 0.01 250)",
    "warning": "oklch(0.80 0.16 70)",
    "warning-foreground": "oklch(0.15 0.05 70)",
    "border": "oklch(0.25 0.03 250)",
    "input": "oklch(0.18 0.012 250)",
    "ring": "oklch(0.70 0.18 200)",
    "rating": "oklch(0.80 0.16 85)",
    "rating-foreground": "oklch(0.40 0.08 85)",
    "chart-1": "oklch(0.70 0.18 200)",
    "chart-2": "oklch(0.75 0.20 280)",
    "chart-3": "oklch(0.70 0.22 340)",
    "chart-4": "oklch(0.70 0.18 160)",
    "chart-5": "oklch(0.75 0.15 230)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'midnight-tech';

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4. SUNSET BOHEMIAN — "Artesanal Cálido"                              │
-- │    Playfair Display / Lato / JetBrains Mono · large radius · medium    │
-- └─────────────────────────────────────────────────────────────────────────┘
UPDATE store_themes SET
  name = 'Sunset Bohemian',
  description = 'Artisan warmth — terracotta, elegant serif typography, handcrafted feel',
  category = 'bohemian',
  fonts = '{"heading": "Playfair Display", "body": "Lato", "mono": "JetBrains Mono"}'::jsonb,
  border_radius = '1rem',
  shadow_preset = 'medium',
  css_variables = '{
    "background": "oklch(0.97 0.015 60)",
    "foreground": "oklch(0.20 0.03 50)",
    "card": "oklch(0.985 0.01 60)",
    "card-foreground": "oklch(0.20 0.03 50)",
    "popover": "oklch(0.985 0.01 60)",
    "popover-foreground": "oklch(0.20 0.03 50)",
    "primary": "oklch(0.60 0.16 40)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.95 0.018 60)",
    "secondary-foreground": "oklch(0.20 0.03 50)",
    "muted": "oklch(0.93 0.02 60)",
    "muted-foreground": "oklch(0.50 0.03 50)",
    "accent": "oklch(0.80 0.10 85)",
    "accent-foreground": "oklch(0.20 0.03 50)",
    "destructive": "oklch(0.55 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.60 0.15 155)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.78 0.14 80)",
    "warning-foreground": "oklch(0.30 0.06 80)",
    "border": "oklch(0.88 0.025 60)",
    "input": "oklch(0.95 0.018 60)",
    "ring": "oklch(0.60 0.16 40)",
    "rating": "oklch(0.80 0.14 85)",
    "rating-foreground": "oklch(0.40 0.08 85)",
    "chart-1": "oklch(0.60 0.16 40)",
    "chart-2": "oklch(0.80 0.10 85)",
    "chart-3": "oklch(0.60 0.12 155)",
    "chart-4": "oklch(0.70 0.14 20)",
    "chart-5": "oklch(0.55 0.10 30)"
  }'::jsonb,
  css_variables_dark = '{
    "background": "oklch(0.14 0.015 50)",
    "foreground": "oklch(0.92 0.015 60)",
    "card": "oklch(0.19 0.018 50)",
    "card-foreground": "oklch(0.92 0.015 60)",
    "popover": "oklch(0.19 0.018 50)",
    "popover-foreground": "oklch(0.92 0.015 60)",
    "primary": "oklch(0.68 0.16 40)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.22 0.02 50)",
    "secondary-foreground": "oklch(0.92 0.015 60)",
    "muted": "oklch(0.24 0.022 50)",
    "muted-foreground": "oklch(0.62 0.02 60)",
    "accent": "oklch(0.72 0.10 85)",
    "accent-foreground": "oklch(0.92 0.015 60)",
    "destructive": "oklch(0.60 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.65 0.15 155)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.80 0.14 80)",
    "warning-foreground": "oklch(0.20 0.06 80)",
    "border": "oklch(0.30 0.025 50)",
    "input": "oklch(0.22 0.02 50)",
    "ring": "oklch(0.68 0.16 40)",
    "rating": "oklch(0.80 0.14 85)",
    "rating-foreground": "oklch(0.40 0.08 85)",
    "chart-1": "oklch(0.68 0.16 40)",
    "chart-2": "oklch(0.72 0.10 85)",
    "chart-3": "oklch(0.65 0.12 155)",
    "chart-4": "oklch(0.75 0.14 20)",
    "chart-5": "oklch(0.60 0.10 30)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'sunset-bohemian';

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 5. OCEAN BREEZE — "Costa Mediterránea"                                │
-- │    Poppins / Poppins / JetBrains Mono · medium radius · subtle shadow  │
-- └─────────────────────────────────────────────────────────────────────────┘
UPDATE store_themes SET
  name = 'Ocean Breeze',
  description = 'Coastal Mediterranean — turquoise sea, sandy warmth, breezy and relaxed',
  category = 'outdoor',
  fonts = '{"heading": "Poppins", "body": "Poppins", "mono": "JetBrains Mono"}'::jsonb,
  border_radius = '0.75rem',
  shadow_preset = 'subtle',
  css_variables = '{
    "background": "oklch(0.985 0.008 210)",
    "foreground": "oklch(0.18 0.02 210)",
    "card": "oklch(0.995 0.004 210)",
    "card-foreground": "oklch(0.18 0.02 210)",
    "popover": "oklch(0.995 0.004 210)",
    "popover-foreground": "oklch(0.18 0.02 210)",
    "primary": "oklch(0.55 0.15 210)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.955 0.01 210)",
    "secondary-foreground": "oklch(0.18 0.02 210)",
    "muted": "oklch(0.94 0.012 210)",
    "muted-foreground": "oklch(0.50 0.02 210)",
    "accent": "oklch(0.78 0.10 80)",
    "accent-foreground": "oklch(0.20 0.03 80)",
    "destructive": "oklch(0.55 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.60 0.18 160)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.78 0.14 70)",
    "warning-foreground": "oklch(0.30 0.06 70)",
    "border": "oklch(0.90 0.01 210)",
    "input": "oklch(0.955 0.01 210)",
    "ring": "oklch(0.55 0.15 210)",
    "rating": "oklch(0.80 0.14 85)",
    "rating-foreground": "oklch(0.40 0.08 85)",
    "chart-1": "oklch(0.55 0.15 210)",
    "chart-2": "oklch(0.78 0.10 80)",
    "chart-3": "oklch(0.65 0.15 15)",
    "chart-4": "oklch(0.60 0.12 190)",
    "chart-5": "oklch(0.70 0.10 230)"
  }'::jsonb,
  css_variables_dark = '{
    "background": "oklch(0.13 0.008 210)",
    "foreground": "oklch(0.93 0.008 210)",
    "card": "oklch(0.18 0.01 210)",
    "card-foreground": "oklch(0.93 0.008 210)",
    "popover": "oklch(0.18 0.01 210)",
    "popover-foreground": "oklch(0.93 0.008 210)",
    "primary": "oklch(0.65 0.15 210)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.22 0.012 210)",
    "secondary-foreground": "oklch(0.93 0.008 210)",
    "muted": "oklch(0.24 0.015 210)",
    "muted-foreground": "oklch(0.62 0.015 210)",
    "accent": "oklch(0.70 0.10 80)",
    "accent-foreground": "oklch(0.93 0.008 210)",
    "destructive": "oklch(0.60 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.65 0.18 160)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.80 0.14 70)",
    "warning-foreground": "oklch(0.20 0.06 70)",
    "border": "oklch(0.28 0.015 210)",
    "input": "oklch(0.22 0.012 210)",
    "ring": "oklch(0.65 0.15 210)",
    "rating": "oklch(0.80 0.14 85)",
    "rating-foreground": "oklch(0.40 0.08 85)",
    "chart-1": "oklch(0.65 0.15 210)",
    "chart-2": "oklch(0.70 0.10 80)",
    "chart-3": "oklch(0.70 0.15 15)",
    "chart-4": "oklch(0.65 0.12 190)",
    "chart-5": "oklch(0.75 0.10 230)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'ocean-breeze';

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 6. LUXURY GOLD — "Premium Editorial"                                  │
-- │    Playfair Display / Montserrat / JetBrains Mono · no radius · none   │
-- └─────────────────────────────────────────────────────────────────────────┘
UPDATE store_themes SET
  name = 'Luxury Gold',
  description = 'Premium editorial — sharp corners, gold on ivory/black, luxury magazine feel',
  category = 'premium',
  fonts = '{"heading": "Playfair Display", "body": "Montserrat", "mono": "JetBrains Mono"}'::jsonb,
  border_radius = '0rem',
  shadow_preset = 'none',
  css_variables = '{
    "background": "oklch(0.98 0.005 80)",
    "foreground": "oklch(0.18 0.01 80)",
    "card": "oklch(0.995 0.003 80)",
    "card-foreground": "oklch(0.18 0.01 80)",
    "popover": "oklch(0.995 0.003 80)",
    "popover-foreground": "oklch(0.18 0.01 80)",
    "primary": "oklch(0.75 0.12 85)",
    "primary-foreground": "oklch(0.18 0.01 80)",
    "secondary": "oklch(0.955 0.008 80)",
    "secondary-foreground": "oklch(0.18 0.01 80)",
    "muted": "oklch(0.94 0.01 80)",
    "muted-foreground": "oklch(0.50 0.02 80)",
    "accent": "oklch(0.40 0.02 80)",
    "accent-foreground": "oklch(0.98 0.005 80)",
    "destructive": "oklch(0.55 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.60 0.15 150)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.78 0.14 80)",
    "warning-foreground": "oklch(0.30 0.06 80)",
    "border": "oklch(0.88 0.025 80)",
    "input": "oklch(0.955 0.008 80)",
    "ring": "oklch(0.75 0.12 85)",
    "rating": "oklch(0.75 0.12 85)",
    "rating-foreground": "oklch(0.35 0.05 85)",
    "chart-1": "oklch(0.75 0.12 85)",
    "chart-2": "oklch(0.40 0.02 80)",
    "chart-3": "oklch(0.70 0.08 350)",
    "chart-4": "oklch(0.60 0.08 85)",
    "chart-5": "oklch(0.55 0.05 80)"
  }'::jsonb,
  css_variables_dark = '{
    "background": "oklch(0.12 0.008 80)",
    "foreground": "oklch(0.93 0.008 80)",
    "card": "oklch(0.17 0.01 80)",
    "card-foreground": "oklch(0.93 0.008 80)",
    "popover": "oklch(0.17 0.01 80)",
    "popover-foreground": "oklch(0.93 0.008 80)",
    "primary": "oklch(0.78 0.12 85)",
    "primary-foreground": "oklch(0.12 0.008 80)",
    "secondary": "oklch(0.22 0.012 80)",
    "secondary-foreground": "oklch(0.93 0.008 80)",
    "muted": "oklch(0.24 0.015 80)",
    "muted-foreground": "oklch(0.60 0.015 80)",
    "accent": "oklch(0.50 0.02 80)",
    "accent-foreground": "oklch(0.93 0.008 80)",
    "destructive": "oklch(0.60 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.65 0.15 150)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.80 0.14 80)",
    "warning-foreground": "oklch(0.20 0.06 80)",
    "border": "oklch(0.30 0.02 80)",
    "input": "oklch(0.22 0.012 80)",
    "ring": "oklch(0.78 0.12 85)",
    "rating": "oklch(0.78 0.12 85)",
    "rating-foreground": "oklch(0.35 0.05 85)",
    "chart-1": "oklch(0.78 0.12 85)",
    "chart-2": "oklch(0.50 0.02 80)",
    "chart-3": "oklch(0.72 0.08 350)",
    "chart-4": "oklch(0.65 0.08 85)",
    "chart-5": "oklch(0.60 0.05 80)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'luxury-gold';

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 7. CANDY POP — "Divertido y Atrevido"                                │
-- │    Poppins / Outfit / JetBrains Mono · full radius · medium shadow     │
-- └─────────────────────────────────────────────────────────────────────────┘
UPDATE store_themes SET
  name = 'Candy Pop',
  description = 'Bold and playful — magenta/violet streetwear, extra rounded, youthful energy',
  category = 'fun',
  fonts = '{"heading": "Poppins", "body": "Outfit", "mono": "JetBrains Mono"}'::jsonb,
  border_radius = '2rem',
  shadow_preset = 'medium',
  css_variables = '{
    "background": "oklch(0.985 0.01 330)",
    "foreground": "oklch(0.18 0.02 330)",
    "card": "oklch(0.995 0.005 330)",
    "card-foreground": "oklch(0.18 0.02 330)",
    "popover": "oklch(0.995 0.005 330)",
    "popover-foreground": "oklch(0.18 0.02 330)",
    "primary": "oklch(0.65 0.22 350)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.955 0.015 330)",
    "secondary-foreground": "oklch(0.18 0.02 330)",
    "muted": "oklch(0.94 0.018 330)",
    "muted-foreground": "oklch(0.50 0.02 330)",
    "accent": "oklch(0.55 0.22 300)",
    "accent-foreground": "oklch(1.0 0 0)",
    "destructive": "oklch(0.55 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.65 0.18 155)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.82 0.15 85)",
    "warning-foreground": "oklch(0.28 0.06 85)",
    "border": "oklch(0.90 0.015 330)",
    "input": "oklch(0.955 0.015 330)",
    "ring": "oklch(0.65 0.22 350)",
    "rating": "oklch(0.82 0.15 85)",
    "rating-foreground": "oklch(0.38 0.08 85)",
    "chart-1": "oklch(0.65 0.22 350)",
    "chart-2": "oklch(0.55 0.22 300)",
    "chart-3": "oklch(0.82 0.15 85)",
    "chart-4": "oklch(0.70 0.18 320)",
    "chart-5": "oklch(0.60 0.15 270)"
  }'::jsonb,
  css_variables_dark = '{
    "background": "oklch(0.13 0.012 330)",
    "foreground": "oklch(0.93 0.01 330)",
    "card": "oklch(0.18 0.015 330)",
    "card-foreground": "oklch(0.93 0.01 330)",
    "popover": "oklch(0.18 0.015 330)",
    "popover-foreground": "oklch(0.93 0.01 330)",
    "primary": "oklch(0.70 0.22 350)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.22 0.018 330)",
    "secondary-foreground": "oklch(0.93 0.01 330)",
    "muted": "oklch(0.24 0.02 330)",
    "muted-foreground": "oklch(0.62 0.015 330)",
    "accent": "oklch(0.60 0.22 300)",
    "accent-foreground": "oklch(1.0 0 0)",
    "destructive": "oklch(0.60 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.70 0.18 155)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.85 0.15 85)",
    "warning-foreground": "oklch(0.22 0.06 85)",
    "border": "oklch(0.28 0.02 330)",
    "input": "oklch(0.22 0.018 330)",
    "ring": "oklch(0.70 0.22 350)",
    "rating": "oklch(0.85 0.15 85)",
    "rating-foreground": "oklch(0.38 0.08 85)",
    "chart-1": "oklch(0.70 0.22 350)",
    "chart-2": "oklch(0.60 0.22 300)",
    "chart-3": "oklch(0.85 0.15 85)",
    "chart-4": "oklch(0.75 0.18 320)",
    "chart-5": "oklch(0.65 0.15 270)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'candy-pop';

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 8. MONOCHROME MINIMAL — "Bauhaus Escandinavo"                         │
-- │    Inter / Inter / JetBrains Mono · small radius · no shadow           │
-- └─────────────────────────────────────────────────────────────────────────┘
UPDATE store_themes SET
  name = 'Monochrome Minimal',
  description = 'Bauhaus Scandinavian — pure grayscale with a single blue accent, zero decoration',
  category = 'minimal',
  fonts = '{"heading": "Inter", "body": "Inter", "mono": "JetBrains Mono"}'::jsonb,
  border_radius = '0.375rem',
  shadow_preset = 'none',
  css_variables = '{
    "background": "oklch(0.98 0 0)",
    "foreground": "oklch(0.15 0 0)",
    "card": "oklch(1.0 0 0)",
    "card-foreground": "oklch(0.15 0 0)",
    "popover": "oklch(1.0 0 0)",
    "popover-foreground": "oklch(0.15 0 0)",
    "primary": "oklch(0.20 0 0)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.955 0 0)",
    "secondary-foreground": "oklch(0.15 0 0)",
    "muted": "oklch(0.94 0 0)",
    "muted-foreground": "oklch(0.50 0 0)",
    "accent": "oklch(0.55 0.08 250)",
    "accent-foreground": "oklch(1.0 0 0)",
    "destructive": "oklch(0.55 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.55 0.15 150)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.72 0.12 70)",
    "warning-foreground": "oklch(0.28 0.05 70)",
    "border": "oklch(0.90 0 0)",
    "input": "oklch(0.955 0 0)",
    "ring": "oklch(0.20 0 0)",
    "rating": "oklch(0.75 0.12 85)",
    "rating-foreground": "oklch(0.40 0.06 85)",
    "chart-1": "oklch(0.30 0 0)",
    "chart-2": "oklch(0.55 0.08 250)",
    "chart-3": "oklch(0.50 0 0)",
    "chart-4": "oklch(0.70 0 0)",
    "chart-5": "oklch(0.85 0 0)"
  }'::jsonb,
  css_variables_dark = '{
    "background": "oklch(0.12 0 0)",
    "foreground": "oklch(0.92 0 0)",
    "card": "oklch(0.17 0 0)",
    "card-foreground": "oklch(0.92 0 0)",
    "popover": "oklch(0.17 0 0)",
    "popover-foreground": "oklch(0.92 0 0)",
    "primary": "oklch(0.92 0 0)",
    "primary-foreground": "oklch(0.12 0 0)",
    "secondary": "oklch(0.22 0 0)",
    "secondary-foreground": "oklch(0.92 0 0)",
    "muted": "oklch(0.24 0 0)",
    "muted-foreground": "oklch(0.60 0 0)",
    "accent": "oklch(0.60 0.08 250)",
    "accent-foreground": "oklch(0.92 0 0)",
    "destructive": "oklch(0.60 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.60 0.15 150)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.75 0.12 70)",
    "warning-foreground": "oklch(0.20 0.05 70)",
    "border": "oklch(0.28 0 0)",
    "input": "oklch(0.22 0 0)",
    "ring": "oklch(0.92 0 0)",
    "rating": "oklch(0.75 0.12 85)",
    "rating-foreground": "oklch(0.40 0.06 85)",
    "chart-1": "oklch(0.80 0 0)",
    "chart-2": "oklch(0.60 0.08 250)",
    "chart-3": "oklch(0.60 0 0)",
    "chart-4": "oklch(0.40 0 0)",
    "chart-5": "oklch(0.25 0 0)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'monochrome-minimal';

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 9. VINTAGE RETRO — "Nostalgia Sepia"                                  │
-- │    Merriweather / Roboto / JetBrains Mono · no radius · medium shadow  │
-- └─────────────────────────────────────────────────────────────────────────┘
UPDATE store_themes SET
  name = 'Vintage Retro',
  description = 'Nostalgic sepia — aged paper, classic serif, olive green and mustard accents',
  category = 'vintage',
  fonts = '{"heading": "Merriweather", "body": "Roboto", "mono": "JetBrains Mono"}'::jsonb,
  border_radius = '0rem',
  shadow_preset = 'medium',
  css_variables = '{
    "background": "oklch(0.965 0.02 70)",
    "foreground": "oklch(0.22 0.02 70)",
    "card": "oklch(0.975 0.015 70)",
    "card-foreground": "oklch(0.22 0.02 70)",
    "popover": "oklch(0.975 0.015 70)",
    "popover-foreground": "oklch(0.22 0.02 70)",
    "primary": "oklch(0.50 0.12 140)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.94 0.02 70)",
    "secondary-foreground": "oklch(0.22 0.02 70)",
    "muted": "oklch(0.92 0.025 70)",
    "muted-foreground": "oklch(0.48 0.02 70)",
    "accent": "oklch(0.72 0.14 85)",
    "accent-foreground": "oklch(0.22 0.02 70)",
    "destructive": "oklch(0.50 0.18 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.55 0.14 145)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.72 0.14 85)",
    "warning-foreground": "oklch(0.30 0.06 85)",
    "border": "oklch(0.85 0.03 70)",
    "input": "oklch(0.94 0.02 70)",
    "ring": "oklch(0.50 0.12 140)",
    "rating": "oklch(0.72 0.14 85)",
    "rating-foreground": "oklch(0.38 0.06 85)",
    "chart-1": "oklch(0.50 0.12 140)",
    "chart-2": "oklch(0.72 0.14 85)",
    "chart-3": "oklch(0.58 0.14 30)",
    "chart-4": "oklch(0.62 0.08 160)",
    "chart-5": "oklch(0.45 0.08 70)"
  }'::jsonb,
  css_variables_dark = '{
    "background": "oklch(0.14 0.015 70)",
    "foreground": "oklch(0.90 0.015 70)",
    "card": "oklch(0.19 0.018 70)",
    "card-foreground": "oklch(0.90 0.015 70)",
    "popover": "oklch(0.19 0.018 70)",
    "popover-foreground": "oklch(0.90 0.015 70)",
    "primary": "oklch(0.60 0.12 140)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.22 0.02 70)",
    "secondary-foreground": "oklch(0.90 0.015 70)",
    "muted": "oklch(0.24 0.022 70)",
    "muted-foreground": "oklch(0.60 0.015 70)",
    "accent": "oklch(0.68 0.14 85)",
    "accent-foreground": "oklch(0.90 0.015 70)",
    "destructive": "oklch(0.58 0.18 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.60 0.14 145)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.75 0.14 85)",
    "warning-foreground": "oklch(0.22 0.06 85)",
    "border": "oklch(0.30 0.025 70)",
    "input": "oklch(0.22 0.02 70)",
    "ring": "oklch(0.60 0.12 140)",
    "rating": "oklch(0.72 0.14 85)",
    "rating-foreground": "oklch(0.38 0.06 85)",
    "chart-1": "oklch(0.60 0.12 140)",
    "chart-2": "oklch(0.68 0.14 85)",
    "chart-3": "oklch(0.65 0.14 30)",
    "chart-4": "oklch(0.68 0.08 160)",
    "chart-5": "oklch(0.52 0.08 70)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'vintage-retro';

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 10. ROYAL PURPLE — "Noche Elegante"                                   │
-- │    Montserrat / Lato / JetBrains Mono · medium radius · large shadow   │
-- └─────────────────────────────────────────────────────────────────────────┘
UPDATE store_themes SET
  name = 'Royal Purple',
  description = 'Elegant night — deep royal purple, dramatic shadows, sophisticated evening feel',
  category = 'premium',
  fonts = '{"heading": "Montserrat", "body": "Lato", "mono": "JetBrains Mono"}'::jsonb,
  border_radius = '0.75rem',
  shadow_preset = 'large',
  css_variables = '{
    "background": "oklch(0.98 0.008 290)",
    "foreground": "oklch(0.18 0.02 290)",
    "card": "oklch(0.995 0.004 290)",
    "card-foreground": "oklch(0.18 0.02 290)",
    "popover": "oklch(0.995 0.004 290)",
    "popover-foreground": "oklch(0.18 0.02 290)",
    "primary": "oklch(0.50 0.22 290)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.955 0.012 290)",
    "secondary-foreground": "oklch(0.18 0.02 290)",
    "muted": "oklch(0.94 0.015 290)",
    "muted-foreground": "oklch(0.50 0.02 290)",
    "accent": "oklch(0.65 0.18 330)",
    "accent-foreground": "oklch(1.0 0 0)",
    "destructive": "oklch(0.55 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.60 0.15 150)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.78 0.14 70)",
    "warning-foreground": "oklch(0.30 0.06 70)",
    "border": "oklch(0.88 0.015 290)",
    "input": "oklch(0.955 0.012 290)",
    "ring": "oklch(0.50 0.22 290)",
    "rating": "oklch(0.78 0.14 85)",
    "rating-foreground": "oklch(0.40 0.08 85)",
    "chart-1": "oklch(0.50 0.22 290)",
    "chart-2": "oklch(0.65 0.18 330)",
    "chart-3": "oklch(0.75 0.12 85)",
    "chart-4": "oklch(0.55 0.15 260)",
    "chart-5": "oklch(0.60 0.10 310)"
  }'::jsonb,
  css_variables_dark = '{
    "background": "oklch(0.12 0.01 290)",
    "foreground": "oklch(0.93 0.008 290)",
    "card": "oklch(0.17 0.015 290)",
    "card-foreground": "oklch(0.93 0.008 290)",
    "popover": "oklch(0.17 0.015 290)",
    "popover-foreground": "oklch(0.93 0.008 290)",
    "primary": "oklch(0.60 0.22 290)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.22 0.015 290)",
    "secondary-foreground": "oklch(0.93 0.008 290)",
    "muted": "oklch(0.24 0.018 290)",
    "muted-foreground": "oklch(0.62 0.012 290)",
    "accent": "oklch(0.68 0.18 330)",
    "accent-foreground": "oklch(1.0 0 0)",
    "destructive": "oklch(0.60 0.22 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.65 0.15 150)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.80 0.14 70)",
    "warning-foreground": "oklch(0.20 0.06 70)",
    "border": "oklch(0.28 0.02 290)",
    "input": "oklch(0.22 0.015 290)",
    "ring": "oklch(0.60 0.22 290)",
    "rating": "oklch(0.78 0.14 85)",
    "rating-foreground": "oklch(0.40 0.08 85)",
    "chart-1": "oklch(0.60 0.22 290)",
    "chart-2": "oklch(0.68 0.18 330)",
    "chart-3": "oklch(0.78 0.12 85)",
    "chart-4": "oklch(0.58 0.15 260)",
    "chart-5": "oklch(0.65 0.10 310)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'royal-purple';

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 11. HIGH CONTRAST — "Accesibilidad Total"                             │
-- │    Inter / Inter / JetBrains Mono · small radius · no shadow           │
-- │    Pure black/white for WCAG AAA compliance                           │
-- └─────────────────────────────────────────────────────────────────────────┘
UPDATE store_themes SET
  name = 'High Contrast',
  description = 'Maximum accessibility — pure black/white, thick borders, WCAG AAA compliant',
  category = 'high_contrast',
  fonts = '{"heading": "Inter", "body": "Inter", "mono": "JetBrains Mono"}'::jsonb,
  border_radius = '0.375rem',
  shadow_preset = 'none',
  css_variables = '{
    "background": "oklch(1.0 0 0)",
    "foreground": "oklch(0.0 0 0)",
    "card": "oklch(1.0 0 0)",
    "card-foreground": "oklch(0.0 0 0)",
    "popover": "oklch(1.0 0 0)",
    "popover-foreground": "oklch(0.0 0 0)",
    "primary": "oklch(0.0 0 0)",
    "primary-foreground": "oklch(1.0 0 0)",
    "secondary": "oklch(0.95 0 0)",
    "secondary-foreground": "oklch(0.0 0 0)",
    "muted": "oklch(0.93 0 0)",
    "muted-foreground": "oklch(0.30 0 0)",
    "accent": "oklch(0.45 0.20 245)",
    "accent-foreground": "oklch(1.0 0 0)",
    "destructive": "oklch(0.45 0.25 25)",
    "destructive-foreground": "oklch(1.0 0 0)",
    "success": "oklch(0.40 0.18 150)",
    "success-foreground": "oklch(1.0 0 0)",
    "warning": "oklch(0.65 0.18 70)",
    "warning-foreground": "oklch(0.0 0 0)",
    "border": "oklch(0.0 0 0)",
    "input": "oklch(0.95 0 0)",
    "ring": "oklch(0.45 0.20 245)",
    "rating": "oklch(0.65 0.18 85)",
    "rating-foreground": "oklch(0.0 0 0)",
    "chart-1": "oklch(0.0 0 0)",
    "chart-2": "oklch(0.45 0.20 245)",
    "chart-3": "oklch(0.45 0.25 25)",
    "chart-4": "oklch(0.40 0.18 150)",
    "chart-5": "oklch(0.65 0.18 70)"
  }'::jsonb,
  css_variables_dark = '{
    "background": "oklch(0.0 0 0)",
    "foreground": "oklch(1.0 0 0)",
    "card": "oklch(0.08 0 0)",
    "card-foreground": "oklch(1.0 0 0)",
    "popover": "oklch(0.08 0 0)",
    "popover-foreground": "oklch(1.0 0 0)",
    "primary": "oklch(1.0 0 0)",
    "primary-foreground": "oklch(0.0 0 0)",
    "secondary": "oklch(0.15 0 0)",
    "secondary-foreground": "oklch(1.0 0 0)",
    "muted": "oklch(0.18 0 0)",
    "muted-foreground": "oklch(0.75 0 0)",
    "accent": "oklch(0.65 0.20 245)",
    "accent-foreground": "oklch(0.0 0 0)",
    "destructive": "oklch(0.65 0.25 25)",
    "destructive-foreground": "oklch(0.0 0 0)",
    "success": "oklch(0.65 0.18 150)",
    "success-foreground": "oklch(0.0 0 0)",
    "warning": "oklch(0.80 0.18 70)",
    "warning-foreground": "oklch(0.0 0 0)",
    "border": "oklch(1.0 0 0)",
    "input": "oklch(0.15 0 0)",
    "ring": "oklch(0.65 0.20 245)",
    "rating": "oklch(0.80 0.18 85)",
    "rating-foreground": "oklch(0.0 0 0)",
    "chart-1": "oklch(1.0 0 0)",
    "chart-2": "oklch(0.65 0.20 245)",
    "chart-3": "oklch(0.65 0.25 25)",
    "chart-4": "oklch(0.65 0.18 150)",
    "chart-5": "oklch(0.80 0.18 70)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'high-contrast';

-- ─── Verification ──────────────────────────────────────────────────────────

-- Ensure ocean-blue is still default
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM store_themes WHERE slug = 'ocean-blue' AND is_default = true) THEN
    RAISE EXCEPTION 'ocean-blue must remain the default theme';
  END IF;

  -- Verify we have exactly 11 themes
  IF (SELECT count(*) FROM store_themes WHERE is_custom = false) != 11 THEN
    RAISE EXCEPTION 'Expected 11 built-in themes, got %',
      (SELECT count(*) FROM store_themes WHERE is_custom = false);
  END IF;
END $$;

COMMIT;
