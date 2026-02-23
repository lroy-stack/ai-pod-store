-- Fix Ocean Blue accent token: teal (hue 200, chroma 0.15) → subtle gray-blue
-- The accent token is used by ghost button hover (hover:bg-accent).
-- A vibrant teal is wrong for a hover highlight — it should be a subtle surface color.

UPDATE store_themes SET
  css_variables = jsonb_set(
    jsonb_set(css_variables, '{accent}', '"oklch(0.94 0.015 245)"'),
    '{accent-foreground}', '"oklch(0.15 0.01 245)"'
  ),
  css_variables_dark = jsonb_set(
    jsonb_set(css_variables_dark, '{accent}', '"oklch(0.25 0.015 245)"'),
    '{accent-foreground}', '"oklch(0.95 0.005 245)"'
  )
WHERE slug = 'ocean-blue';
