-- Add brand identity columns to brand_config table
-- Required for feature #96: brand_config has identity columns

-- Add brand_name column
ALTER TABLE brand_config
ADD COLUMN IF NOT EXISTS brand_name TEXT DEFAULT 'Skapara';

-- Add brand_tagline column
ALTER TABLE brand_config
ADD COLUMN IF NOT EXISTS brand_tagline TEXT DEFAULT 'AI-Powered Print on Demand';

-- Add SEO titles (i18n JSONB)
ALTER TABLE brand_config
ADD COLUMN IF NOT EXISTS seo_titles JSONB DEFAULT '{"en": "Skapara - AI Print on Demand", "es": "Skapara - Impresión bajo Demanda con IA", "de": "Skapara - KI-gesteuerte Druckerei"}'::jsonb;

-- Add SEO descriptions (i18n JSONB)
ALTER TABLE brand_config
ADD COLUMN IF NOT EXISTS seo_descriptions JSONB DEFAULT '{"en": "Create unique custom products with AI-powered design tools and on-demand printing", "es": "Crea productos personalizados únicos con herramientas de diseño impulsadas por IA e impresión bajo demanda", "de": "Erstellen Sie einzigartige personalisierte Produkte mit KI-gestützten Designwerkzeugen und Druck auf Abruf"}'::jsonb;

-- Add logo URLs
ALTER TABLE brand_config
ADD COLUMN IF NOT EXISTS logo_light_url TEXT DEFAULT NULL;

ALTER TABLE brand_config
ADD COLUMN IF NOT EXISTS logo_dark_url TEXT DEFAULT NULL;

-- Add support email
ALTER TABLE brand_config
ADD COLUMN IF NOT EXISTS support_email TEXT DEFAULT 'support@skapara.com';

-- Add social links (JSONB)
ALTER TABLE brand_config
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{"twitter": "", "instagram": "", "facebook": "", "linkedin": ""}'::jsonb;

-- Add copyright text
ALTER TABLE brand_config
ADD COLUMN IF NOT EXISTS copyright_text TEXT DEFAULT '© 2026 Skapara. All rights reserved.';

-- Add comments for documentation
COMMENT ON COLUMN brand_config.brand_name IS 'Brand name displayed across the platform (e.g., "Skapara")';
COMMENT ON COLUMN brand_config.brand_tagline IS 'Brand tagline or slogan';
COMMENT ON COLUMN brand_config.seo_titles IS 'Localized SEO page titles (JSONB with en/es/de keys)';
COMMENT ON COLUMN brand_config.seo_descriptions IS 'Localized SEO meta descriptions (JSONB with en/es/de keys)';
COMMENT ON COLUMN brand_config.logo_light_url IS 'URL for logo used in light mode';
COMMENT ON COLUMN brand_config.logo_dark_url IS 'URL for logo used in dark mode';
COMMENT ON COLUMN brand_config.support_email IS 'Customer support contact email';
COMMENT ON COLUMN brand_config.social_links IS 'Social media profile links (JSONB object)';
COMMENT ON COLUMN brand_config.copyright_text IS 'Copyright notice displayed in footer';
