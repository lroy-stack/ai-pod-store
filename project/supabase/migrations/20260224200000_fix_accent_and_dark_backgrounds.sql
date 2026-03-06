-- ============================================================================
-- Fix accent tokens (subtle surface, not vibrant) + raise dark backgrounds
-- ============================================================================
-- Problem 1: accent in 10/11 themes was a vibrant brand color. shadcn/ui uses
--   accent for ghost-button hover (hover:bg-accent). Must be subtle surface.
-- Problem 2: dark backgrounds were 0.10-0.14 lightness (too black).
--   Raised to ~0.16-0.18 for a professional dark feel with theme tint.
-- Warm Slate (slug ocean-blue) already correct — skipped.
-- ============================================================================

BEGIN;

-- ── Forest Eco ──────────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables = css_variables || '{
    "accent": "oklch(0.95 0.012 145)",
    "accent-foreground": "oklch(0.18 0.03 145)"
  }'::jsonb,
  css_variables_dark = css_variables_dark || '{
    "accent": "oklch(0.26 0.015 145)",
    "accent-foreground": "oklch(0.93 0.01 145)",
    "background": "oklch(0.18 0.012 145)",
    "card": "oklch(0.22 0.015 145)",
    "popover": "oklch(0.22 0.015 145)",
    "secondary": "oklch(0.25 0.015 145)",
    "muted": "oklch(0.27 0.018 145)",
    "input": "oklch(0.25 0.015 145)",
    "border": "oklch(0.32 0.018 145)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'forest-eco';

-- ── Midnight Tech ───────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables = css_variables || '{
    "accent": "oklch(0.94 0.008 250)",
    "accent-foreground": "oklch(0.15 0.01 250)"
  }'::jsonb,
  css_variables_dark = css_variables_dark || '{
    "accent": "oklch(0.24 0.015 250)",
    "accent-foreground": "oklch(0.92 0.005 250)",
    "background": "oklch(0.16 0.012 250)",
    "card": "oklch(0.20 0.012 250)",
    "popover": "oklch(0.20 0.012 250)",
    "secondary": "oklch(0.23 0.012 250)",
    "muted": "oklch(0.25 0.015 250)",
    "input": "oklch(0.23 0.012 250)",
    "border": "oklch(0.30 0.025 250)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'midnight-tech';

-- ── Sunset Bohemian ─────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables = css_variables || '{
    "accent": "oklch(0.95 0.018 60)",
    "accent-foreground": "oklch(0.20 0.03 50)"
  }'::jsonb,
  css_variables_dark = css_variables_dark || '{
    "accent": "oklch(0.26 0.020 50)",
    "accent-foreground": "oklch(0.92 0.015 60)",
    "background": "oklch(0.18 0.015 50)",
    "card": "oklch(0.22 0.018 50)",
    "popover": "oklch(0.22 0.018 50)",
    "secondary": "oklch(0.25 0.020 50)",
    "muted": "oklch(0.27 0.022 50)",
    "input": "oklch(0.25 0.020 50)",
    "border": "oklch(0.33 0.025 50)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'sunset-bohemian';

-- ── Ocean Breeze ────────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables = css_variables || '{
    "accent": "oklch(0.955 0.010 210)",
    "accent-foreground": "oklch(0.18 0.02 210)"
  }'::jsonb,
  css_variables_dark = css_variables_dark || '{
    "accent": "oklch(0.26 0.012 210)",
    "accent-foreground": "oklch(0.93 0.008 210)",
    "background": "oklch(0.17 0.010 210)",
    "card": "oklch(0.21 0.012 210)",
    "popover": "oklch(0.21 0.012 210)",
    "secondary": "oklch(0.25 0.012 210)",
    "muted": "oklch(0.27 0.015 210)",
    "input": "oklch(0.25 0.012 210)",
    "border": "oklch(0.32 0.015 210)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'ocean-breeze';

-- ── Luxury Gold ─────────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables = css_variables || '{
    "accent": "oklch(0.955 0.008 80)",
    "accent-foreground": "oklch(0.18 0.01 80)"
  }'::jsonb,
  css_variables_dark = css_variables_dark || '{
    "accent": "oklch(0.26 0.012 80)",
    "accent-foreground": "oklch(0.93 0.008 80)",
    "background": "oklch(0.16 0.010 80)",
    "card": "oklch(0.20 0.012 80)",
    "popover": "oklch(0.20 0.012 80)",
    "secondary": "oklch(0.25 0.012 80)",
    "muted": "oklch(0.27 0.015 80)",
    "input": "oklch(0.25 0.012 80)",
    "border": "oklch(0.33 0.020 80)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'luxury-gold';

-- ── Candy Pop ───────────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables = css_variables || '{
    "accent": "oklch(0.955 0.015 330)",
    "accent-foreground": "oklch(0.18 0.02 330)"
  }'::jsonb,
  css_variables_dark = css_variables_dark || '{
    "accent": "oklch(0.26 0.018 330)",
    "accent-foreground": "oklch(0.93 0.01 330)",
    "background": "oklch(0.17 0.012 330)",
    "card": "oklch(0.21 0.015 330)",
    "popover": "oklch(0.21 0.015 330)",
    "secondary": "oklch(0.25 0.018 330)",
    "muted": "oklch(0.27 0.020 330)",
    "input": "oklch(0.25 0.018 330)",
    "border": "oklch(0.32 0.020 330)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'candy-pop';

-- ── Monochrome Minimal ─────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables = css_variables || '{
    "accent": "oklch(0.955 0 0)",
    "accent-foreground": "oklch(0.15 0 0)"
  }'::jsonb,
  css_variables_dark = css_variables_dark || '{
    "accent": "oklch(0.26 0 0)",
    "accent-foreground": "oklch(0.92 0 0)",
    "background": "oklch(0.16 0 0)",
    "card": "oklch(0.20 0 0)",
    "popover": "oklch(0.20 0 0)",
    "secondary": "oklch(0.24 0 0)",
    "muted": "oklch(0.27 0 0)",
    "input": "oklch(0.24 0 0)",
    "border": "oklch(0.32 0 0)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'monochrome-minimal';

-- ── Vintage Retro ──────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables = css_variables || '{
    "accent": "oklch(0.945 0.020 70)",
    "accent-foreground": "oklch(0.22 0.02 70)"
  }'::jsonb,
  css_variables_dark = css_variables_dark || '{
    "accent": "oklch(0.26 0.020 70)",
    "accent-foreground": "oklch(0.90 0.015 70)",
    "background": "oklch(0.18 0.015 70)",
    "card": "oklch(0.22 0.018 70)",
    "popover": "oklch(0.22 0.018 70)",
    "secondary": "oklch(0.25 0.020 70)",
    "muted": "oklch(0.27 0.022 70)",
    "input": "oklch(0.25 0.020 70)",
    "border": "oklch(0.33 0.025 70)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'vintage-retro';

-- ── Royal Purple ───────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables = css_variables || '{
    "accent": "oklch(0.955 0.012 290)",
    "accent-foreground": "oklch(0.18 0.02 290)"
  }'::jsonb,
  css_variables_dark = css_variables_dark || '{
    "accent": "oklch(0.26 0.015 290)",
    "accent-foreground": "oklch(0.93 0.008 290)",
    "background": "oklch(0.16 0.012 290)",
    "card": "oklch(0.20 0.015 290)",
    "popover": "oklch(0.20 0.015 290)",
    "secondary": "oklch(0.25 0.015 290)",
    "muted": "oklch(0.27 0.018 290)",
    "input": "oklch(0.25 0.015 290)",
    "border": "oklch(0.32 0.020 290)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'royal-purple';

-- ── High Contrast (keep extreme but not pure black) ────────────────────────
UPDATE store_themes SET
  css_variables = css_variables || '{
    "accent": "oklch(0.94 0 0)",
    "accent-foreground": "oklch(0.0 0 0)"
  }'::jsonb,
  css_variables_dark = css_variables_dark || '{
    "accent": "oklch(0.22 0 0)",
    "accent-foreground": "oklch(1.0 0 0)",
    "background": "oklch(0.06 0 0)",
    "card": "oklch(0.11 0 0)",
    "popover": "oklch(0.11 0 0)",
    "secondary": "oklch(0.17 0 0)",
    "muted": "oklch(0.20 0 0)",
    "input": "oklch(0.17 0 0)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'high-contrast';

COMMIT;
