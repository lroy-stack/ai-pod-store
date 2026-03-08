-- Marketing system: hero campaigns, collections, collection products
-- Enables dynamic landing page content managed from admin without deploy

-- collections first (hero_campaigns references it)
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name JSONB NOT NULL DEFAULT '{}',
  description JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hero_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'archived')),
  priority INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,

  -- Hero content (i18n via JSONB — keys: en, es, de)
  title JSONB NOT NULL DEFAULT '{}',
  subtitle JSONB DEFAULT '{}',
  cta_text JSONB NOT NULL DEFAULT '{}',
  cta_url TEXT NOT NULL DEFAULT '/shop',
  sub_cta_text JSONB DEFAULT '{}',

  -- Images (Supabase Storage public URLs)
  image_url TEXT,
  image_alt JSONB DEFAULT '{}',
  og_image_url TEXT,

  -- Linked collection
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_products (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  PRIMARY KEY (collection_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hero_campaigns_active
  ON hero_campaigns(priority DESC, starts_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_collection_products_order
  ON collection_products(collection_id, position);

CREATE INDEX IF NOT EXISTS idx_collections_status
  ON collections(status);

-- RLS: hero_campaigns
ALTER TABLE hero_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY hero_campaigns_public_read ON hero_campaigns
  FOR SELECT USING (status = 'active');

CREATE POLICY hero_campaigns_admin_all ON hero_campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RLS: collections
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY collections_public_read ON collections
  FOR SELECT USING (status = 'active');

CREATE POLICY collections_admin_all ON collections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RLS: collection_products
ALTER TABLE collection_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY collection_products_public_read ON collection_products
  FOR SELECT USING (true);

CREATE POLICY collection_products_admin_all ON collection_products
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Storage bucket for marketing images (hero, OG)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketing',
  'marketing',
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for marketing bucket (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'marketing_public_read' AND tablename = 'objects') THEN
    EXECUTE 'CREATE POLICY marketing_public_read ON storage.objects FOR SELECT USING (bucket_id = ''marketing'')';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'marketing_admin_write' AND tablename = 'objects') THEN
    EXECUTE 'CREATE POLICY marketing_admin_write ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = ''marketing'')';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'marketing_admin_update' AND tablename = 'objects') THEN
    EXECUTE 'CREATE POLICY marketing_admin_update ON storage.objects FOR UPDATE TO service_role USING (bucket_id = ''marketing'') WITH CHECK (bucket_id = ''marketing'')';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'marketing_admin_delete' AND tablename = 'objects') THEN
    EXECUTE 'CREATE POLICY marketing_admin_delete ON storage.objects FOR DELETE TO service_role USING (bucket_id = ''marketing'')';
  END IF;
END
$$;
