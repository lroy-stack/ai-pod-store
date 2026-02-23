-- Upgrade vector index from IVFFlat to HNSW for better performance
-- HNSW (Hierarchical Navigable Small World) provides better query performance
-- and recall compared to IVFFlat for approximate nearest neighbor search

-- Drop the old IVFFlat index
DROP INDEX IF EXISTS idx_documents_embedding;

-- Create new HNSW index with optimal parameters
-- m = 16: maximum connections per layer (good balance of speed/memory)
-- ef_construction = 64: quality of index construction (good balance of speed/quality)
CREATE INDEX idx_documents_embedding ON documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
