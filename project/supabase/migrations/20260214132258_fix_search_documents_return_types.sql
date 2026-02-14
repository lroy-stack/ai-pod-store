-- Fix search_documents function return types to match actual column types
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding vector(768),
  match_count int DEFAULT 10,
  filter_locale text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  source_type text,
  source_id uuid,
  locale text,
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
    d.source_type::text,
    d.source_id,
    d.locale::text,
    (1 - (d.embedding <=> query_embedding))::float AS similarity
  FROM documents d
  WHERE
    (filter_locale IS NULL OR d.locale = filter_locale)
    AND d.embedding IS NOT NULL
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
