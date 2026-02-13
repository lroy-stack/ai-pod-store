-- Migration: Create Infrastructure Tables
-- Description: Create audit_log and documents tables (with vector embeddings)
-- Date: 2026-02-13

-- =============================================
-- AUDIT LOG TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('admin', 'ai_agent', 'system', 'webhook')),
  actor_id VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  changes JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- DOCUMENTS TABLE (for RAG pipeline)
-- =============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(768),
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('product', 'design', 'faq', 'policy')),
  source_id VARCHAR(255),
  locale CHAR(5) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR INFRASTRUCTURE TABLES
-- =============================================

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_type_actor_id ON audit_log(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type_resource_id ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_source_type_source_id ON documents(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_documents_locale ON documents(locale);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Vector similarity index using HNSW (Hierarchical Navigable Small World)
-- This is optimized for approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat index (can be used instead of HNSW)
-- CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- =============================================
-- RPC FUNCTION: Search Documents (RAG)
-- =============================================
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_locale char(5) DEFAULT 'en'
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  source_type varchar,
  source_id varchar,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    d.source_type,
    d.source_id,
    1 - (d.embedding <=> query_embedding) as similarity
  FROM documents d
  WHERE d.locale = filter_locale
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================
-- RPC FUNCTION: Update Product Rating
-- =============================================
CREATE OR REPLACE FUNCTION update_product_rating(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET
    avg_rating = (
      SELECT COALESCE(AVG(rating)::numeric(2,1), 0)
      FROM product_reviews
      WHERE product_id = p_product_id
    ),
    review_count = (
      SELECT COUNT(*)::int
      FROM product_reviews
      WHERE product_id = p_product_id
    )
  WHERE id = p_product_id;
END;
$$;

-- =============================================
-- TRIGGER: Auto-update product rating after review
-- =============================================
CREATE OR REPLACE FUNCTION update_product_rating_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM update_product_rating(NEW.product_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_product_rating(OLD.product_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER product_reviews_rating_update
AFTER INSERT OR UPDATE OR DELETE ON product_reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating_trigger();

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
