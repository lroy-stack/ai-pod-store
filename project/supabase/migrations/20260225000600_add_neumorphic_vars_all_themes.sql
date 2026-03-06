-- Add neumorphic (neu-*) CSS variables to all themes that are missing them.
-- Each theme gets values adapted to its visual personality (color, radius, shadow intensity).
-- Also fixes Neon Cyberpunk missing semantic vars (destructive, success, warning, rating, charts).

-- ============================================================
-- 1. CANDY POP — playful, rounded, pink primary hue 350
-- ============================================================
UPDATE public.store_themes
SET css_variables = css_variables || jsonb_build_object(
  'neu-out', '5px 5px 14px rgba(0,0,0,0.08), -5px -5px 14px rgba(255,255,255,0.92)',
  'neu-out-hover', '8px 8px 22px rgba(0,0,0,0.10), -6px -6px 18px rgba(255,255,255,0.95)',
  'neu-in', 'inset 2px 2px 6px rgba(0,0,0,0.08), inset -2px -2px 6px rgba(255,255,255,0.92)',
  'neu-btn', '3px 3px 8px rgba(0,0,0,0.08), -3px -3px 8px rgba(255,255,255,0.90)',
  'neu-accent-glow', '3px 3px 10px rgba(230,50,120,0.30), -2px -2px 5px rgba(255,255,255,0.5)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(230,50,120,0.45)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.625rem',
  'neu-card-radius', '1.5rem',
  'neu-image-radius', '1rem',
  'neu-input-radius', '50px',
  'neu-hover-lift', 'translateY(-3px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
),
css_variables_dark = css_variables_dark || jsonb_build_object(
  'neu-out', '5px 5px 14px rgba(0,0,0,0.30), -5px -5px 14px rgba(255,255,255,0.03)',
  'neu-out-hover', '8px 8px 22px rgba(0,0,0,0.35), -6px -6px 18px rgba(255,255,255,0.05)',
  'neu-in', 'inset 2px 2px 6px rgba(0,0,0,0.30), inset -2px -2px 6px rgba(255,255,255,0.03)',
  'neu-btn', '3px 3px 8px rgba(0,0,0,0.25), -3px -3px 8px rgba(255,255,255,0.03)',
  'neu-accent-glow', '3px 3px 10px rgba(230,50,120,0.35), -2px -2px 5px rgba(255,255,255,0.03)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(230,50,120,0.50)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.625rem',
  'neu-card-radius', '1.5rem',
  'neu-image-radius', '1rem',
  'neu-input-radius', '50px',
  'neu-hover-lift', 'translateY(-3px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
)
WHERE name = 'Candy Pop';

-- ============================================================
-- 2. FOREST ECO — natural, earthy, green primary hue 150
-- ============================================================
UPDATE public.store_themes
SET css_variables = css_variables || jsonb_build_object(
  'neu-out', '5px 5px 12px rgba(0,0,0,0.08), -5px -5px 12px rgba(255,255,255,0.88)',
  'neu-out-hover', '8px 8px 20px rgba(0,0,0,0.10), -6px -6px 16px rgba(255,255,255,0.92)',
  'neu-in', 'inset 2px 2px 6px rgba(0,0,0,0.08), inset -2px -2px 6px rgba(255,255,255,0.88)',
  'neu-btn', '3px 3px 8px rgba(0,0,0,0.08), -3px -3px 8px rgba(255,255,255,0.85)',
  'neu-accent-glow', '3px 3px 10px rgba(40,160,80,0.30), -2px -2px 5px rgba(255,255,255,0.5)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(40,160,80,0.45)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.625rem',
  'neu-card-radius', '1.25rem',
  'neu-image-radius', '0.75rem',
  'neu-input-radius', '50px',
  'neu-hover-lift', 'translateY(-3px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
),
css_variables_dark = css_variables_dark || jsonb_build_object(
  'neu-out', '5px 5px 12px rgba(0,0,0,0.30), -5px -5px 12px rgba(255,255,255,0.04)',
  'neu-out-hover', '8px 8px 20px rgba(0,0,0,0.35), -6px -6px 16px rgba(255,255,255,0.06)',
  'neu-in', 'inset 2px 2px 6px rgba(0,0,0,0.30), inset -2px -2px 6px rgba(255,255,255,0.04)',
  'neu-btn', '3px 3px 8px rgba(0,0,0,0.25), -3px -3px 8px rgba(255,255,255,0.03)',
  'neu-accent-glow', '3px 3px 10px rgba(40,160,80,0.35), -2px -2px 5px rgba(255,255,255,0.03)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(40,160,80,0.50)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.625rem',
  'neu-card-radius', '1.25rem',
  'neu-image-radius', '0.75rem',
  'neu-input-radius', '50px',
  'neu-hover-lift', 'translateY(-3px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
)
WHERE name = 'Forest Eco';

-- ============================================================
-- 3. HIGH CONTRAST — sharp, accessible, achromatic primary
-- ============================================================
UPDATE public.store_themes
SET css_variables = css_variables || jsonb_build_object(
  'neu-out', '4px 4px 10px rgba(0,0,0,0.12), -4px -4px 10px rgba(255,255,255,0.95)',
  'neu-out-hover', '6px 6px 16px rgba(0,0,0,0.15), -5px -5px 14px rgba(255,255,255,0.98)',
  'neu-in', 'inset 2px 2px 5px rgba(0,0,0,0.12), inset -2px -2px 5px rgba(255,255,255,0.95)',
  'neu-btn', '2px 2px 6px rgba(0,0,0,0.10), -2px -2px 6px rgba(255,255,255,0.90)',
  'neu-accent-glow', '2px 2px 8px rgba(0,0,0,0.20), -2px -2px 4px rgba(255,255,255,0.5)',
  'neu-accent-glow-hover', '3px 3px 12px rgba(0,0,0,0.30)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.5rem',
  'neu-card-radius', '0.75rem',
  'neu-image-radius', '0.375rem',
  'neu-input-radius', '0.5rem',
  'neu-hover-lift', 'translateY(-2px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
),
css_variables_dark = css_variables_dark || jsonb_build_object(
  'neu-out', '4px 4px 10px rgba(0,0,0,0.40), -4px -4px 10px rgba(255,255,255,0.05)',
  'neu-out-hover', '6px 6px 16px rgba(0,0,0,0.45), -5px -5px 14px rgba(255,255,255,0.07)',
  'neu-in', 'inset 2px 2px 5px rgba(0,0,0,0.35), inset -2px -2px 5px rgba(255,255,255,0.05)',
  'neu-btn', '2px 2px 6px rgba(0,0,0,0.30), -2px -2px 6px rgba(255,255,255,0.04)',
  'neu-accent-glow', '2px 2px 8px rgba(255,255,255,0.15), -2px -2px 4px rgba(255,255,255,0.03)',
  'neu-accent-glow-hover', '3px 3px 12px rgba(255,255,255,0.25)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.5rem',
  'neu-card-radius', '0.75rem',
  'neu-image-radius', '0.375rem',
  'neu-input-radius', '0.5rem',
  'neu-hover-lift', 'translateY(-2px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
)
WHERE name = 'High Contrast';

-- ============================================================
-- 4. LUXURY GOLD — sharp edges, gold primary hue 85
-- ============================================================
UPDATE public.store_themes
SET css_variables = css_variables || jsonb_build_object(
  'neu-out', '4px 4px 10px rgba(0,0,0,0.08), -4px -4px 10px rgba(255,255,255,0.90)',
  'neu-out-hover', '6px 6px 16px rgba(0,0,0,0.10), -5px -5px 14px rgba(255,255,255,0.94)',
  'neu-in', 'inset 2px 2px 5px rgba(0,0,0,0.08), inset -2px -2px 5px rgba(255,255,255,0.90)',
  'neu-btn', '2px 2px 6px rgba(0,0,0,0.08), -2px -2px 6px rgba(255,255,255,0.88)',
  'neu-accent-glow', '3px 3px 10px rgba(200,170,50,0.30), -2px -2px 5px rgba(255,255,255,0.5)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(200,170,50,0.45)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.5rem',
  'neu-card-radius', '0.25rem',
  'neu-image-radius', '0.125rem',
  'neu-input-radius', '0.25rem',
  'neu-hover-lift', 'translateY(-2px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
),
css_variables_dark = css_variables_dark || jsonb_build_object(
  'neu-out', '4px 4px 10px rgba(0,0,0,0.30), -4px -4px 10px rgba(255,255,255,0.03)',
  'neu-out-hover', '6px 6px 16px rgba(0,0,0,0.35), -5px -5px 14px rgba(255,255,255,0.05)',
  'neu-in', 'inset 2px 2px 5px rgba(0,0,0,0.30), inset -2px -2px 5px rgba(255,255,255,0.03)',
  'neu-btn', '2px 2px 6px rgba(0,0,0,0.25), -2px -2px 6px rgba(255,255,255,0.03)',
  'neu-accent-glow', '3px 3px 10px rgba(200,170,50,0.35), -2px -2px 5px rgba(255,255,255,0.03)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(200,170,50,0.50)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.5rem',
  'neu-card-radius', '0.25rem',
  'neu-image-radius', '0.125rem',
  'neu-input-radius', '0.25rem',
  'neu-hover-lift', 'translateY(-2px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
)
WHERE name = 'Luxury Gold';

-- ============================================================
-- 5. MIDNIGHT TECH — sharp, techy, cyan primary hue 200
-- ============================================================
UPDATE public.store_themes
SET css_variables = css_variables || jsonb_build_object(
  'neu-out', '4px 4px 10px rgba(0,0,0,0.10), -4px -4px 10px rgba(255,255,255,0.88)',
  'neu-out-hover', '6px 6px 16px rgba(0,0,0,0.12), -5px -5px 14px rgba(255,255,255,0.92)',
  'neu-in', 'inset 2px 2px 5px rgba(0,0,0,0.10), inset -2px -2px 5px rgba(255,255,255,0.88)',
  'neu-btn', '2px 2px 6px rgba(0,0,0,0.10), -2px -2px 6px rgba(255,255,255,0.85)',
  'neu-accent-glow', '3px 3px 10px rgba(40,130,200,0.30), -2px -2px 5px rgba(255,255,255,0.5)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(40,130,200,0.45)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.5rem',
  'neu-card-radius', '0.75rem',
  'neu-image-radius', '0.375rem',
  'neu-input-radius', '0.5rem',
  'neu-hover-lift', 'translateY(-2px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
),
css_variables_dark = css_variables_dark || jsonb_build_object(
  'neu-out', '4px 4px 10px rgba(0,0,0,0.35), -4px -4px 10px rgba(255,255,255,0.04)',
  'neu-out-hover', '6px 6px 16px rgba(0,0,0,0.40), -5px -5px 14px rgba(255,255,255,0.06)',
  'neu-in', 'inset 2px 2px 5px rgba(0,0,0,0.35), inset -2px -2px 5px rgba(255,255,255,0.04)',
  'neu-btn', '2px 2px 6px rgba(0,0,0,0.30), -2px -2px 6px rgba(255,255,255,0.03)',
  'neu-accent-glow', '3px 3px 10px rgba(40,130,200,0.40), -2px -2px 5px rgba(255,255,255,0.03)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(40,130,200,0.55)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.5rem',
  'neu-card-radius', '0.75rem',
  'neu-image-radius', '0.375rem',
  'neu-input-radius', '0.5rem',
  'neu-hover-lift', 'translateY(-2px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
)
WHERE name = 'Midnight Tech';

-- ============================================================
-- 6. MONOCHROME MINIMAL — sharp, pure grayscale
-- ============================================================
UPDATE public.store_themes
SET css_variables = css_variables || jsonb_build_object(
  'neu-out', '4px 4px 10px rgba(0,0,0,0.08), -4px -4px 10px rgba(255,255,255,0.92)',
  'neu-out-hover', '6px 6px 16px rgba(0,0,0,0.10), -5px -5px 14px rgba(255,255,255,0.95)',
  'neu-in', 'inset 2px 2px 5px rgba(0,0,0,0.08), inset -2px -2px 5px rgba(255,255,255,0.92)',
  'neu-btn', '2px 2px 6px rgba(0,0,0,0.08), -2px -2px 6px rgba(255,255,255,0.88)',
  'neu-accent-glow', '2px 2px 8px rgba(50,50,50,0.20), -2px -2px 4px rgba(255,255,255,0.5)',
  'neu-accent-glow-hover', '3px 3px 12px rgba(50,50,50,0.30)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.5rem',
  'neu-card-radius', '0.75rem',
  'neu-image-radius', '0.375rem',
  'neu-input-radius', '0.5rem',
  'neu-hover-lift', 'translateY(-2px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
),
css_variables_dark = css_variables_dark || jsonb_build_object(
  'neu-out', '4px 4px 10px rgba(0,0,0,0.35), -4px -4px 10px rgba(255,255,255,0.04)',
  'neu-out-hover', '6px 6px 16px rgba(0,0,0,0.40), -5px -5px 14px rgba(255,255,255,0.06)',
  'neu-in', 'inset 2px 2px 5px rgba(0,0,0,0.35), inset -2px -2px 5px rgba(255,255,255,0.04)',
  'neu-btn', '2px 2px 6px rgba(0,0,0,0.30), -2px -2px 6px rgba(255,255,255,0.03)',
  'neu-accent-glow', '2px 2px 8px rgba(200,200,200,0.12), -2px -2px 4px rgba(255,255,255,0.03)',
  'neu-accent-glow-hover', '3px 3px 12px rgba(200,200,200,0.20)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.5rem',
  'neu-card-radius', '0.75rem',
  'neu-image-radius', '0.375rem',
  'neu-input-radius', '0.5rem',
  'neu-hover-lift', 'translateY(-2px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
)
WHERE name = 'Monochrome Minimal';

-- ============================================================
-- 7. NEON CYBERPUNK — dark-first, neon magenta primary hue 330
-- Also adds missing semantic vars
-- ============================================================
UPDATE public.store_themes
SET css_variables = css_variables || jsonb_build_object(
  'neu-out', '4px 4px 12px rgba(0,0,0,0.20), -4px -4px 12px rgba(255,255,255,0.05)',
  'neu-out-hover', '6px 6px 18px rgba(0,0,0,0.25), -5px -5px 15px rgba(255,255,255,0.07)',
  'neu-in', 'inset 2px 2px 6px rgba(0,0,0,0.25), inset -2px -2px 6px rgba(255,255,255,0.04)',
  'neu-btn', '2px 2px 8px rgba(0,0,0,0.20), -2px -2px 8px rgba(255,255,255,0.04)',
  'neu-accent-glow', '3px 3px 12px rgba(255,30,200,0.40), -2px -2px 6px rgba(255,255,255,0.03)',
  'neu-accent-glow-hover', '3px 3px 16px rgba(255,30,200,0.55)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.5rem',
  'neu-card-radius', '0.75rem',
  'neu-image-radius', '0.375rem',
  'neu-input-radius', '0.5rem',
  'neu-hover-lift', 'translateY(-3px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)',
  'input', 'oklch(0.15 0.005 330)',
  'destructive', 'oklch(0.60 0.25 25)',
  'destructive-foreground', 'oklch(1.0 0 0)',
  'success', 'oklch(0.65 0.22 155)',
  'success-foreground', 'oklch(1.0 0 0)',
  'warning', 'oklch(0.75 0.18 85)',
  'warning-foreground', 'oklch(0.20 0.05 85)',
  'rating', 'oklch(0.80 0.16 85)',
  'rating-foreground', 'oklch(0.40 0.08 85)',
  'popover', 'oklch(0.12 0.005 330)',
  'popover-foreground', 'oklch(0.95 0.01 330)',
  'card-foreground', 'oklch(0.95 0.01 330)',
  'chart-1', 'oklch(0.70 0.30 330)',
  'chart-2', 'oklch(0.65 0.25 200)',
  'chart-3', 'oklch(0.70 0.22 130)',
  'chart-4', 'oklch(0.75 0.20 60)',
  'chart-5', 'oklch(0.60 0.28 290)'
),
css_variables_dark = css_variables_dark || jsonb_build_object(
  'neu-out', '4px 4px 12px rgba(0,0,0,0.35), -4px -4px 12px rgba(255,255,255,0.03)',
  'neu-out-hover', '6px 6px 18px rgba(0,0,0,0.40), -5px -5px 15px rgba(255,255,255,0.05)',
  'neu-in', 'inset 2px 2px 6px rgba(0,0,0,0.40), inset -2px -2px 6px rgba(255,255,255,0.03)',
  'neu-btn', '2px 2px 8px rgba(0,0,0,0.30), -2px -2px 8px rgba(255,255,255,0.03)',
  'neu-accent-glow', '3px 3px 12px rgba(255,30,200,0.45), -2px -2px 6px rgba(255,255,255,0.02)',
  'neu-accent-glow-hover', '3px 3px 16px rgba(255,30,200,0.60)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.5rem',
  'neu-card-radius', '0.75rem',
  'neu-image-radius', '0.375rem',
  'neu-input-radius', '0.5rem',
  'neu-hover-lift', 'translateY(-3px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)',
  'input', 'oklch(0.15 0.005 330)',
  'destructive', 'oklch(0.60 0.25 25)',
  'destructive-foreground', 'oklch(1.0 0 0)',
  'success', 'oklch(0.65 0.22 155)',
  'success-foreground', 'oklch(1.0 0 0)',
  'warning', 'oklch(0.78 0.18 85)',
  'warning-foreground', 'oklch(0.20 0.05 85)',
  'rating', 'oklch(0.80 0.16 85)',
  'rating-foreground', 'oklch(0.40 0.08 85)',
  'popover', 'oklch(0.12 0.005 330)',
  'popover-foreground', 'oklch(0.95 0.01 330)',
  'card-foreground', 'oklch(0.95 0.01 330)',
  'chart-1', 'oklch(0.70 0.30 330)',
  'chart-2', 'oklch(0.65 0.25 200)',
  'chart-3', 'oklch(0.70 0.22 130)',
  'chart-4', 'oklch(0.75 0.20 60)',
  'chart-5', 'oklch(0.60 0.28 290)'
)
WHERE name = 'Neon Cyberpunk';

-- ============================================================
-- 8. OCEAN BREEZE — medium radius, fresh, blue primary hue 210
-- ============================================================
UPDATE public.store_themes
SET css_variables = css_variables || jsonb_build_object(
  'neu-out', '5px 5px 12px rgba(0,0,0,0.08), -5px -5px 12px rgba(255,255,255,0.90)',
  'neu-out-hover', '8px 8px 20px rgba(0,0,0,0.10), -6px -6px 16px rgba(255,255,255,0.94)',
  'neu-in', 'inset 2px 2px 6px rgba(0,0,0,0.08), inset -2px -2px 6px rgba(255,255,255,0.90)',
  'neu-btn', '3px 3px 8px rgba(0,0,0,0.08), -3px -3px 8px rgba(255,255,255,0.88)',
  'neu-accent-glow', '3px 3px 10px rgba(40,120,200,0.30), -2px -2px 5px rgba(255,255,255,0.5)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(40,120,200,0.45)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.625rem',
  'neu-card-radius', '1rem',
  'neu-image-radius', '0.5rem',
  'neu-input-radius', '2rem',
  'neu-hover-lift', 'translateY(-3px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
),
css_variables_dark = css_variables_dark || jsonb_build_object(
  'neu-out', '5px 5px 12px rgba(0,0,0,0.30), -5px -5px 12px rgba(255,255,255,0.04)',
  'neu-out-hover', '8px 8px 20px rgba(0,0,0,0.35), -6px -6px 16px rgba(255,255,255,0.06)',
  'neu-in', 'inset 2px 2px 6px rgba(0,0,0,0.30), inset -2px -2px 6px rgba(255,255,255,0.04)',
  'neu-btn', '3px 3px 8px rgba(0,0,0,0.25), -3px -3px 8px rgba(255,255,255,0.03)',
  'neu-accent-glow', '3px 3px 10px rgba(40,120,200,0.40), -2px -2px 5px rgba(255,255,255,0.03)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(40,120,200,0.55)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.625rem',
  'neu-card-radius', '1rem',
  'neu-image-radius', '0.5rem',
  'neu-input-radius', '2rem',
  'neu-hover-lift', 'translateY(-3px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
)
WHERE name = 'Ocean Breeze';

-- ============================================================
-- 9. ROYAL PURPLE — rich, medium radius, purple primary hue 290
-- ============================================================
UPDATE public.store_themes
SET css_variables = css_variables || jsonb_build_object(
  'neu-out', '5px 5px 14px rgba(0,0,0,0.10), -5px -5px 14px rgba(255,255,255,0.88)',
  'neu-out-hover', '8px 8px 22px rgba(0,0,0,0.12), -6px -6px 18px rgba(255,255,255,0.92)',
  'neu-in', 'inset 2px 2px 6px rgba(0,0,0,0.10), inset -2px -2px 6px rgba(255,255,255,0.88)',
  'neu-btn', '3px 3px 8px rgba(0,0,0,0.10), -3px -3px 8px rgba(255,255,255,0.85)',
  'neu-accent-glow', '3px 3px 10px rgba(140,40,200,0.30), -2px -2px 5px rgba(255,255,255,0.5)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(140,40,200,0.45)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.625rem',
  'neu-card-radius', '1rem',
  'neu-image-radius', '0.5rem',
  'neu-input-radius', '2rem',
  'neu-hover-lift', 'translateY(-3px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
),
css_variables_dark = css_variables_dark || jsonb_build_object(
  'neu-out', '5px 5px 14px rgba(0,0,0,0.30), -5px -5px 14px rgba(255,255,255,0.04)',
  'neu-out-hover', '8px 8px 22px rgba(0,0,0,0.35), -6px -6px 18px rgba(255,255,255,0.06)',
  'neu-in', 'inset 2px 2px 6px rgba(0,0,0,0.30), inset -2px -2px 6px rgba(255,255,255,0.04)',
  'neu-btn', '3px 3px 8px rgba(0,0,0,0.25), -3px -3px 8px rgba(255,255,255,0.03)',
  'neu-accent-glow', '3px 3px 10px rgba(140,40,200,0.40), -2px -2px 5px rgba(255,255,255,0.03)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(140,40,200,0.55)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.625rem',
  'neu-card-radius', '1rem',
  'neu-image-radius', '0.5rem',
  'neu-input-radius', '2rem',
  'neu-hover-lift', 'translateY(-3px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
)
WHERE name = 'Royal Purple';

-- ============================================================
-- 10. SUNSET BOHEMIAN — warm, organic, orange primary hue 40
-- ============================================================
UPDATE public.store_themes
SET css_variables = css_variables || jsonb_build_object(
  'neu-out', '5px 5px 12px rgba(0,0,0,0.08), -5px -5px 12px rgba(255,255,255,0.88)',
  'neu-out-hover', '8px 8px 20px rgba(0,0,0,0.10), -6px -6px 16px rgba(255,255,255,0.92)',
  'neu-in', 'inset 2px 2px 6px rgba(0,0,0,0.08), inset -2px -2px 6px rgba(255,255,255,0.88)',
  'neu-btn', '3px 3px 8px rgba(0,0,0,0.08), -3px -3px 8px rgba(255,255,255,0.85)',
  'neu-accent-glow', '3px 3px 10px rgba(220,120,40,0.30), -2px -2px 5px rgba(255,255,255,0.5)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(220,120,40,0.45)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.625rem',
  'neu-card-radius', '1.25rem',
  'neu-image-radius', '0.75rem',
  'neu-input-radius', '50px',
  'neu-hover-lift', 'translateY(-3px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
),
css_variables_dark = css_variables_dark || jsonb_build_object(
  'neu-out', '5px 5px 12px rgba(0,0,0,0.30), -5px -5px 12px rgba(255,255,255,0.04)',
  'neu-out-hover', '8px 8px 20px rgba(0,0,0,0.35), -6px -6px 16px rgba(255,255,255,0.06)',
  'neu-in', 'inset 2px 2px 6px rgba(0,0,0,0.30), inset -2px -2px 6px rgba(255,255,255,0.04)',
  'neu-btn', '3px 3px 8px rgba(0,0,0,0.25), -3px -3px 8px rgba(255,255,255,0.03)',
  'neu-accent-glow', '3px 3px 10px rgba(220,120,40,0.40), -2px -2px 5px rgba(255,255,255,0.03)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(220,120,40,0.55)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.625rem',
  'neu-card-radius', '1.25rem',
  'neu-image-radius', '0.75rem',
  'neu-input-radius', '50px',
  'neu-hover-lift', 'translateY(-3px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
)
WHERE name = 'Sunset Bohemian';

-- ============================================================
-- 11. VINTAGE RETRO — sharp edges, sepia, olive-green primary hue 140
-- ============================================================
UPDATE public.store_themes
SET css_variables = css_variables || jsonb_build_object(
  'neu-out', '4px 4px 10px rgba(0,0,0,0.10), -4px -4px 10px rgba(255,255,255,0.85)',
  'neu-out-hover', '6px 6px 16px rgba(0,0,0,0.12), -5px -5px 14px rgba(255,255,255,0.90)',
  'neu-in', 'inset 2px 2px 5px rgba(0,0,0,0.10), inset -2px -2px 5px rgba(255,255,255,0.85)',
  'neu-btn', '2px 2px 6px rgba(0,0,0,0.10), -2px -2px 6px rgba(255,255,255,0.82)',
  'neu-accent-glow', '3px 3px 10px rgba(80,130,60,0.25), -2px -2px 5px rgba(255,255,255,0.5)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(80,130,60,0.40)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.5rem',
  'neu-card-radius', '0.25rem',
  'neu-image-radius', '0.125rem',
  'neu-input-radius', '0.25rem',
  'neu-hover-lift', 'translateY(-2px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
),
css_variables_dark = css_variables_dark || jsonb_build_object(
  'neu-out', '4px 4px 10px rgba(0,0,0,0.30), -4px -4px 10px rgba(255,255,255,0.04)',
  'neu-out-hover', '6px 6px 16px rgba(0,0,0,0.35), -5px -5px 14px rgba(255,255,255,0.06)',
  'neu-in', 'inset 2px 2px 5px rgba(0,0,0,0.30), inset -2px -2px 5px rgba(255,255,255,0.04)',
  'neu-btn', '2px 2px 6px rgba(0,0,0,0.25), -2px -2px 6px rgba(255,255,255,0.03)',
  'neu-accent-glow', '3px 3px 10px rgba(80,130,60,0.35), -2px -2px 5px rgba(255,255,255,0.03)',
  'neu-accent-glow-hover', '3px 3px 14px rgba(80,130,60,0.50)',
  'neu-border-w', '0px',
  'neu-card-pad', '0.5rem',
  'neu-card-radius', '0.25rem',
  'neu-image-radius', '0.125rem',
  'neu-input-radius', '0.25rem',
  'neu-hover-lift', 'translateY(-2px)',
  'neu-fav-bg', 'var(--card)',
  'neu-image-bg', 'var(--background)'
)
WHERE name = 'Vintage Retro';
