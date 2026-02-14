-- Drop and recreate search_documents function with correct column types
-- (Cannot change return type of existing function, must drop first)

DROP FUNCTION IF EXISTS search_documents(vector(768), int, text);

CREATE FUNCTION search_documents(
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
    (1 - (d.embedding <=> query_embedding))::float AS similarity
  FROM documents d
  WHERE
    (filter_locale IS NULL OR d.locale = filter_locale)
    AND d.embedding IS NOT NULL
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
