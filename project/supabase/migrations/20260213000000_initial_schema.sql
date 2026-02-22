-- POD AI Store — Initial Database Schema
-- =========================================
-- 24 tables with pgvector support, RLS policies, and indexes

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ==========================
-- CORE USER TABLES
-- ==========================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  avatar_url TEXT,
  locale CHAR(5) NOT NULL DEFAULT 'en',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  phone VARCHAR(30),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  notification_preferences JSONB NOT NULL DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE shipping_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(50),
  full_name VARCHAR(255),
  street_line1 TEXT NOT NULL,
  street_line2 TEXT,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  postal_code VARCHAR(20) NOT NULL,
  country_code CHAR(2) NOT NULL,
  phone VARCHAR(30),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================
-- PRODUCT & CATALOG TABLES
-- ==========================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printify_id VARCHAR(255) UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  blueprint_id INTEGER,
  print_provider_id INTEGER,
  base_price_cents INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'usd',
  images JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  avg_rating NUMERIC(2,1) DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  printify_variant_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  size VARCHAR(50),
  color VARCHAR(50),
  price_cents INTEGER NOT NULL,
  sku VARCHAR(100),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  style VARCHAR(100),
  model VARCHAR(100),
  image_url TEXT,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generation_time_ms INTEGER
);

-- ==========================
-- ORDER & TRANSACTION TABLES
-- ==========================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  stripe_session_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  printify_order_id VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'submitted', 'in_production', 'shipped', 'delivered', 'cancelled', 'refunded')),
  total_cents INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'usd',
  shipping_address JSONB,
  customer_email VARCHAR(255),
  tracking_number VARCHAR(255),
  tracking_url TEXT,
  carrier VARCHAR(100),
  locale CHAR(5) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL,
  printify_line_item_id VARCHAR(255)
);

-- ==========================
-- CONVERSATION & CHAT TABLES
-- ==========================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  title VARCHAR(500),
  model VARCHAR(100),
  locale CHAR(5) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================
-- RAG & SEARCH TABLES
-- ==========================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding VECTOR(768),
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('product', 'design', 'faq', 'policy')),
  source_id VARCHAR(255),
  locale CHAR(5) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================
-- CART & WISHLIST TABLES
-- ==========================

CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL DEFAULT 'My Wishlist',
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  share_token VARCHAR(64) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wishlist_id, product_id, variant_id)
);

-- ==========================
-- REVIEW & NOTIFICATION TABLES
-- ==========================

CREATE TABLE product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(200),
  body TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  locale CHAR(5) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, user_id, order_id)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================
-- TRANSLATION & i18n TABLE
-- ==========================

CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace VARCHAR(50) NOT NULL,
  key VARCHAR(255) NOT NULL,
  locale CHAR(5) NOT NULL,
  value TEXT NOT NULL,
  is_auto_translated BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(namespace, key, locale)
);

-- ==========================
-- AUDIT & LOGGING TABLES
-- ==========================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('admin', 'ai_agent', 'system', 'webhook')),
  actor_id VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  changes JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================
-- AGENT MONITORING TABLES
-- ==========================

CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number INTEGER,
  session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('research', 'catalog', 'customer', 'finance', 'design', 'seo')),
  status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  features_before INTEGER,
  features_after INTEGER,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  tool_errors INTEGER NOT NULL DEFAULT 0,
  memory_snapshot TEXT,
  error_log TEXT
);

CREATE TABLE agent_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================
-- ANALYTICS TABLES (Python scripts output)
-- ==========================

CREATE TABLE customer_segments (
  customer_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  recency INTEGER NOT NULL,
  frequency INTEGER NOT NULL,
  monetary NUMERIC NOT NULL,
  rfm_score TEXT NOT NULL,
  segment TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE demand_forecasts (
  id BIGSERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  predicted_quantity NUMERIC NOT NULL,
  lower_bound NUMERIC,
  upper_bound NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, forecast_date)
);

CREATE TABLE price_history (
  id BIGSERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE association_rules (
  id BIGSERIAL PRIMARY KEY,
  antecedents TEXT[] NOT NULL,
  consequents TEXT[] NOT NULL,
  support NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL,
  lift NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  variants JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ab_events (
  id BIGSERIAL PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click', 'conversion', 'revenue')),
  value NUMERIC,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================
-- INDEXES
-- ==========================

-- Vector similarity search (HNSW for pgvector)
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Products
CREATE INDEX idx_products_tags ON products USING GIN (tags);
CREATE INDEX idx_products_category_status ON products (category, status);
CREATE INDEX idx_products_avg_rating ON products (avg_rating DESC);
CREATE INDEX idx_products_printify_id ON products (printify_id);

-- Orders
CREATE INDEX idx_orders_user_status ON orders (user_id, status);
CREATE INDEX idx_orders_stripe_session ON orders (stripe_session_id);

-- Conversations & Messages
CREATE INDEX idx_conversations_session_id ON conversations (session_id);
CREATE INDEX idx_conversations_user_id ON conversations (user_id);
CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);

-- Shipping & Addresses
CREATE INDEX idx_shipping_addresses_user_id ON shipping_addresses (user_id);

-- Wishlists
CREATE INDEX idx_wishlists_user_id ON wishlists (user_id);
CREATE INDEX idx_wishlist_items_wishlist_id ON wishlist_items (wishlist_id);

-- Reviews
CREATE INDEX idx_product_reviews_product_id ON product_reviews (product_id);
CREATE INDEX idx_product_reviews_user_id ON product_reviews (user_id);

-- Notifications
CREATE INDEX idx_notifications_user_read ON notifications (user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications (created_at DESC);

-- Translations
CREATE INDEX idx_translations_namespace_locale ON translations (namespace, locale);

-- Audit Log
CREATE INDEX idx_audit_log_actor ON audit_log (actor_type, actor_id);
CREATE INDEX idx_audit_log_resource ON audit_log (resource_type, resource_id);
CREATE INDEX idx_audit_log_created_at ON audit_log (created_at DESC);

-- Agent Events
CREATE INDEX idx_agent_events_session ON agent_events (session_id);
CREATE INDEX idx_agent_events_created_at ON agent_events (created_at DESC);

-- Analytics
CREATE INDEX idx_customer_segments_segment ON customer_segments (segment);
CREATE INDEX idx_customer_segments_rfm ON customer_segments (rfm_score);
CREATE INDEX idx_demand_forecasts_product_date ON demand_forecasts (product_id, forecast_date);
CREATE INDEX idx_price_history_product ON price_history (product_id);
CREATE INDEX idx_price_history_period ON price_history (period_start);
CREATE INDEX idx_association_rules_created_at ON association_rules (created_at DESC);
CREATE INDEX idx_ab_experiments_status ON ab_experiments (status);
CREATE INDEX idx_ab_events_experiment_variant ON ab_events (experiment_id, variant);
CREATE INDEX idx_ab_events_created_at ON ab_events (created_at DESC);

-- ==========================
-- ROW LEVEL SECURITY (RLS)
-- ==========================

-- Enable RLS on user-facing tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Users: can view and update their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Orders: users can view their own orders
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Cart items: users can manage their own cart
CREATE POLICY "Users can manage own cart" ON cart_items
  FOR ALL USING (auth.uid() = user_id);

-- Wishlists: users can manage their own wishlists
CREATE POLICY "Users can manage own wishlists" ON wishlists
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own wishlist items" ON wishlist_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM wishlists WHERE wishlists.id = wishlist_items.wishlist_id AND wishlists.user_id = auth.uid())
  );

-- Notifications: users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications as read" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Shipping addresses: users can manage their own addresses
CREATE POLICY "Users can manage own addresses" ON shipping_addresses
  FOR ALL USING (auth.uid() = user_id);

-- Product reviews: users can create reviews for their own orders
CREATE POLICY "Users can view all reviews" ON product_reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can create own reviews" ON product_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews" ON product_reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- ==========================
-- FUNCTIONS
-- ==========================

-- Function to search documents by embedding similarity
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_locale CHAR(5) DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE
    (filter_locale IS NULL OR documents.locale = filter_locale)
    AND (1 - (documents.embedding <=> query_embedding)) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to update product rating (triggered after review insert/update/delete)
CREATE OR REPLACE FUNCTION update_product_rating(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_avg_rating NUMERIC;
  v_count INTEGER;
BEGIN
  SELECT AVG(rating), COUNT(*)
  INTO v_avg_rating, v_count
  FROM product_reviews
  WHERE product_id = p_product_id;

  UPDATE products
  SET
    avg_rating = COALESCE(ROUND(v_avg_rating, 1), 0),
    review_count = v_count,
    updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;

-- Trigger to update product rating after review changes
CREATE OR REPLACE FUNCTION trigger_update_product_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_product_rating(OLD.product_id);
  ELSE
    PERFORM update_product_rating(NEW.product_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER after_review_change
AFTER INSERT OR UPDATE OR DELETE ON product_reviews
FOR EACH ROW EXECUTE FUNCTION trigger_update_product_rating();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================
-- SEED DATA (optional)
-- ==========================

-- ⚠️  SECURITY: Do NOT insert admin users with hardcoded passwords in migrations!
-- Instead, use the secure admin creation script after deployment:
--   node scripts/create-secure-admin.mjs admin@example.com
--
-- The script generates a cryptographically secure random password and displays it once.
--
-- DEPRECATED: The following INSERT is commented out for security reasons:
-- INSERT INTO users (email, password_hash, name, role, email_verified)
-- VALUES (
--   'admin@podstore.local',
--   '$2b$10$...', -- REMOVED: Never commit hardcoded password hashes
--   'Admin User',
--   'admin',
--   true
-- ) ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'POD AI Store schema created successfully!';
  RAISE NOTICE '24 tables created with pgvector support';
  RAISE NOTICE 'RLS policies enabled on user-facing tables';
  RAISE NOTICE 'Indexes created for optimal query performance';
END $$;
