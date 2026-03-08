-- Brand Narrative Overhaul: Remove "AI-Powered Print on Demand" messaging
-- Replace with lifestyle-first brand positioning: "Wear what you mean"

-- 1. Update brand_config tagline and SEO
UPDATE brand_config SET
  brand_tagline = 'Wear what you mean',
  seo_titles = jsonb_build_object(
    'en', 'SKAPARA — Wear what you mean',
    'es', 'SKAPARA — Viste lo que sientes',
    'de', 'SKAPARA — Trag, was du meinst'
  ),
  seo_descriptions = jsonb_build_object(
    'en', 'Unique fashion & accessories designed with you, made in Europe. Find your next favorite piece.',
    'es', 'Moda y accesorios únicos diseñados contigo, hechos en Europa. Encuentra tu próxima pieza favorita.',
    'de', 'Einzigartige Mode & Accessoires mit dir gestaltet, hergestellt in Europa. Finde dein nächstes Lieblingsstück.'
  ),
  updated_at = now()
WHERE is_active = true;

-- 2. Update seo_meta_tags (per-locale rows)
UPDATE seo_meta_tags SET
  title = 'SKAPARA — Wear what you mean',
  description = 'Unique fashion & accessories designed with you, made in Europe.',
  keywords = 'custom fashion, unique accessories, European fashion, custom design, personalized clothing',
  updated_at = now()
WHERE locale = 'en';

UPDATE seo_meta_tags SET
  title = 'SKAPARA — Viste lo que sientes',
  description = 'Moda y accesorios únicos diseñados contigo, hechos en Europa.',
  keywords = 'moda personalizada, accesorios únicos, moda europea, diseño personalizado, ropa personalizada',
  updated_at = now()
WHERE locale = 'es';

UPDATE seo_meta_tags SET
  title = 'SKAPARA — Trag, was du meinst',
  description = 'Einzigartige Mode & Accessoires mit dir gestaltet, hergestellt in Europa.',
  keywords = 'individuelle Mode, einzigartige Accessoires, europäische Mode, individuelles Design, personalisierte Kleidung',
  updated_at = now()
WHERE locale = 'de';

-- 3. Fix placeholder company name from old "PodClaw Store"
UPDATE legal_settings SET
  settings = jsonb_set(settings, '{company_name}', '"Skapara"')
WHERE settings->>'company_name' = 'PodClaw Store';
