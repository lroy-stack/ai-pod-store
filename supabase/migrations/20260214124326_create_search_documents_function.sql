-- Create search_documents RPC function for vector similarity search
-- This function searches documents using cosine similarity on embeddings

CREATE OR REPLACE FUNCTION search_documents(
  query_embedding vector(768),
  match_count int DEFAULT 10,
  filter_locale text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  source_type varchar(50),
  source_id varchar(255),
  locale char(5),
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
    d.locale,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE
    d.embedding IS NOT NULL
    AND (filter_locale IS NULL OR d.locale = filter_locale)
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION search_documents(vector(768), int, text) TO authenticated, anon;

-- Comment
COMMENT ON FUNCTION search_documents IS 'Vector similarity search using cosine distance. Returns documents ordered by relevance.';
