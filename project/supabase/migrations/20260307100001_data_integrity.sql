-- Migration: Data Integrity
-- CHECK constraints on price columns and FK indexes

-- ============================================================
-- 1. CHECK constraints on price/money columns (>= 0)
-- ============================================================

-- orders.total_cents
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_total_cents_non_negative CHECK (total_cents >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- order_items.unit_price_cents
DO $$ BEGIN
  ALTER TABLE order_items ADD CONSTRAINT order_items_unit_price_cents_non_negative CHECK (unit_price_cents >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- order_items.cost_cents
DO $$ BEGIN
  ALTER TABLE order_items ADD CONSTRAINT order_items_cost_cents_non_negative CHECK (cost_cents IS NULL OR cost_cents >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- products.base_price_cents
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_base_price_cents_non_negative CHECK (base_price_cents IS NULL OR base_price_cents >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- products.cost_cents
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_cost_cents_non_negative CHECK (cost_cents IS NULL OR cost_cents >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- product_variants.price_cents
DO $$ BEGIN
  ALTER TABLE product_variants ADD CONSTRAINT product_variants_price_cents_non_negative CHECK (price_cents >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- product_variants.cost_cents
DO $$ BEGIN
  ALTER TABLE product_variants ADD CONSTRAINT product_variants_cost_cents_non_negative CHECK (cost_cents IS NULL OR cost_cents >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. FK column indexes (CREATE INDEX IF NOT EXISTS)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_designs_product_id ON designs(product_id);
CREATE INDEX IF NOT EXISTS idx_designs_parent_design_id ON designs(parent_design_id);
CREATE INDEX IF NOT EXISTS idx_designs_moderated_by ON designs(moderated_by);
CREATE INDEX IF NOT EXISTS idx_designs_tenant_id ON designs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_personalization_id ON cart_items(personalization_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_tenant_id ON cart_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_parent_generation_id ON ai_generations(parent_generation_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_session_id ON ai_generations(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_id ON analytics_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_design_compositions_product_id ON design_compositions(product_id);
CREATE INDEX IF NOT EXISTS idx_design_compositions_session_id ON design_compositions(session_id);
CREATE INDEX IF NOT EXISTS idx_design_sessions_product_id ON design_sessions(product_id);
CREATE INDEX IF NOT EXISTS idx_marketing_content_product_id ON marketing_content(product_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_user_id ON newsletter_subscribers(user_id);
CREATE INDEX IF NOT EXISTS idx_products_deleted_by ON products(deleted_by);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_approved_by ON return_requests(approved_by);
CREATE INDEX IF NOT EXISTS idx_returns_resolved_by ON returns(resolved_by);
CREATE INDEX IF NOT EXISTS idx_translations_reviewed_by ON translations(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_user_messaging_links_user_id ON user_messaging_links(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by ON user_roles(assigned_by);
CREATE INDEX IF NOT EXISTS idx_wishlists_tenant_id ON wishlists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ab_events_user_id ON ab_events(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_moderated_by ON product_reviews(moderated_by);
