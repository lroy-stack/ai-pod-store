-- Create SEO meta tags table for storing locale-specific SEO data
CREATE TABLE IF NOT EXISTS seo_meta_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale VARCHAR(5) NOT NULL UNIQUE CHECK (locale IN ('en', 'es', 'de')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  keywords TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default meta tags for all locales
INSERT INTO seo_meta_tags (locale, title, description, keywords) VALUES
  ('en', 'Insomnialz - Custom Print on Demand', 'Create custom designs and order high-quality print-on-demand products.', 'print on demand, custom designs, t-shirts, AI designs'),
  ('es', 'Insomnialz - Impresión bajo demanda personalizada', 'Crea diseños personalizados y ordena productos de impresión bajo demanda de alta calidad.', 'impresión bajo demanda, diseños personalizados, camisetas, diseños AI'),
  ('de', 'Insomnialz - Benutzerdefinierter Print-on-Demand', 'Erstellen Sie individuelle Designs und bestellen Sie hochwertige Print-on-Demand-Produkte.', 'Print-on-Demand, individuelle Designs, T-Shirts, KI-Designs')
ON CONFLICT (locale) DO NOTHING;

-- Create index on locale for faster lookups
CREATE INDEX IF NOT EXISTS idx_seo_meta_tags_locale ON seo_meta_tags(locale);

-- Enable RLS (admin-only access)
ALTER TABLE seo_meta_tags ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for frontend pages)
CREATE POLICY "SEO meta tags are publicly readable"
  ON seo_meta_tags FOR SELECT
  USING (true);

-- Only admins can update (will be enforced in API routes)
CREATE POLICY "Admins can update SEO meta tags"
  ON seo_meta_tags FOR UPDATE
  USING (false); -- Will be handled by service role in admin API
