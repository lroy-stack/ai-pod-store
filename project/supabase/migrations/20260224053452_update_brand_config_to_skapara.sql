-- Update brand_config to use Skapara branding
-- Ensures brand_name and SEO fields match the Skapara brand identity

UPDATE brand_config
SET
  brand_name = 'Skapara',
  seo_titles = '{"en": "Skapara — AI-Powered Print on Demand Store", "es": "Skapara — Tienda de Impresión bajo Demanda con IA", "de": "Skapara — KI-gestützter Print-on-Demand-Shop"}'::jsonb,
  seo_descriptions = '{"en": "Create custom designs with AI and get them printed on premium products. Your AI-powered print-on-demand marketplace.", "es": "Crea diseños personalizados con IA e imprímelos en productos premium. Tu tienda de impresión bajo demanda impulsada por IA.", "de": "Erstelle individuelle Designs mit KI und lass sie auf Premium-Produkte drucken. Dein KI-gesteuerter Print-on-Demand-Marktplatz."}'::jsonb
WHERE is_active = true;
