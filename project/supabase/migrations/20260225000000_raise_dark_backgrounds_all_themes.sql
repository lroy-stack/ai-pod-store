-- ============================================================================
-- Raise dark-mode backgrounds across ALL 11 themes
-- ============================================================================
-- Previous values (0.13-0.16 lightness) felt too black.
-- New target: ~0.19-0.20 background, ~0.24 card (VS Code / Linear range).
-- Also updates card, popover, secondary, muted, input, border proportionally.
-- ============================================================================

BEGIN;

-- ── Warm Slate (ocean-blue slug) ────────────────────────────────────────────
UPDATE store_themes SET
  css_variables_dark = css_variables_dark || '{
    "background": "oklch(0.20 0.010 260)",
    "card": "oklch(0.24 0.012 260)",
    "popover": "oklch(0.24 0.012 260)",
    "secondary": "oklch(0.26 0.010 260)",
    "muted": "oklch(0.28 0.012 260)",
    "input": "oklch(0.26 0.010 260)",
    "border": "oklch(0.34 0.012 260)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'ocean-blue';

-- ── Forest Eco ──────────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables_dark = css_variables_dark || '{
    "background": "oklch(0.20 0.014 145)",
    "card": "oklch(0.24 0.016 145)",
    "popover": "oklch(0.24 0.016 145)",
    "secondary": "oklch(0.27 0.016 145)",
    "muted": "oklch(0.29 0.018 145)",
    "input": "oklch(0.27 0.016 145)",
    "border": "oklch(0.34 0.018 145)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'forest-eco';

-- ── Midnight Tech ───────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables_dark = css_variables_dark || '{
    "background": "oklch(0.19 0.014 250)",
    "card": "oklch(0.23 0.014 250)",
    "popover": "oklch(0.23 0.014 250)",
    "secondary": "oklch(0.26 0.014 250)",
    "muted": "oklch(0.28 0.016 250)",
    "input": "oklch(0.26 0.014 250)",
    "border": "oklch(0.34 0.025 250)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'midnight-tech';

-- ── Sunset Bohemian ─────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables_dark = css_variables_dark || '{
    "background": "oklch(0.20 0.016 50)",
    "card": "oklch(0.24 0.018 50)",
    "popover": "oklch(0.24 0.018 50)",
    "secondary": "oklch(0.27 0.020 50)",
    "muted": "oklch(0.29 0.022 50)",
    "input": "oklch(0.27 0.020 50)",
    "border": "oklch(0.35 0.025 50)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'sunset-bohemian';

-- ── Ocean Breeze ────────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables_dark = css_variables_dark || '{
    "background": "oklch(0.20 0.012 210)",
    "card": "oklch(0.24 0.014 210)",
    "popover": "oklch(0.24 0.014 210)",
    "secondary": "oklch(0.27 0.014 210)",
    "muted": "oklch(0.29 0.016 210)",
    "input": "oklch(0.27 0.014 210)",
    "border": "oklch(0.34 0.016 210)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'ocean-breeze';

-- ── Luxury Gold ─────────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables_dark = css_variables_dark || '{
    "background": "oklch(0.19 0.012 80)",
    "card": "oklch(0.23 0.014 80)",
    "popover": "oklch(0.23 0.014 80)",
    "secondary": "oklch(0.27 0.014 80)",
    "muted": "oklch(0.29 0.016 80)",
    "input": "oklch(0.27 0.014 80)",
    "border": "oklch(0.35 0.020 80)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'luxury-gold';

-- ── Candy Pop ───────────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables_dark = css_variables_dark || '{
    "background": "oklch(0.20 0.014 330)",
    "card": "oklch(0.24 0.016 330)",
    "popover": "oklch(0.24 0.016 330)",
    "secondary": "oklch(0.27 0.018 330)",
    "muted": "oklch(0.29 0.020 330)",
    "input": "oklch(0.27 0.018 330)",
    "border": "oklch(0.34 0.020 330)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'candy-pop';

-- ── Monochrome Minimal ─────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables_dark = css_variables_dark || '{
    "background": "oklch(0.19 0 0)",
    "card": "oklch(0.23 0 0)",
    "popover": "oklch(0.23 0 0)",
    "secondary": "oklch(0.26 0 0)",
    "muted": "oklch(0.29 0 0)",
    "input": "oklch(0.26 0 0)",
    "border": "oklch(0.34 0 0)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'monochrome-minimal';

-- ── Vintage Retro ──────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables_dark = css_variables_dark || '{
    "background": "oklch(0.20 0.016 70)",
    "card": "oklch(0.24 0.018 70)",
    "popover": "oklch(0.24 0.018 70)",
    "secondary": "oklch(0.27 0.020 70)",
    "muted": "oklch(0.29 0.022 70)",
    "input": "oklch(0.27 0.020 70)",
    "border": "oklch(0.35 0.025 70)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'vintage-retro';

-- ── Royal Purple ───────────────────────────────────────────────────────────
UPDATE store_themes SET
  css_variables_dark = css_variables_dark || '{
    "background": "oklch(0.20 0.014 290)",
    "card": "oklch(0.24 0.016 290)",
    "popover": "oklch(0.24 0.016 290)",
    "secondary": "oklch(0.27 0.016 290)",
    "muted": "oklch(0.29 0.018 290)",
    "input": "oklch(0.27 0.016 290)",
    "border": "oklch(0.34 0.020 290)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'royal-purple';

-- ── High Contrast (still dark but not pure black) ──────────────────────────
UPDATE store_themes SET
  css_variables_dark = css_variables_dark || '{
    "background": "oklch(0.08 0 0)",
    "card": "oklch(0.13 0 0)",
    "popover": "oklch(0.13 0 0)",
    "secondary": "oklch(0.18 0 0)",
    "muted": "oklch(0.22 0 0)",
    "input": "oklch(0.18 0 0)"
  }'::jsonb,
  updated_at = now()
WHERE slug = 'high-contrast';

COMMIT;
