-- Fix hybrid_search_documents return types to match actual table schema
-- source_id is VARCHAR(255), not UUID
-- source_type is VARCHAR(50), not TEXT
-- locale is CHAR(5), not TEXT

DROP FUNCTION IF EXISTS hybrid_search_documents(vector, text, int, text);

CREATE OR REPLACE FUNCTION hybrid_search_documents(
  query_embedding vector(768),
  query_text text,
  match_count int DEFAULT 10,
  filter_locale text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  source_type text,
  source_id text,
  locale text,
  similarity float,
  text_rank float,
  hybrid_score float
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
    d.source_id::text,
    d.locale::text,
    (1 - (d.embedding <=> query_embedding))::float AS similarity,
    ts_rank(
      to_tsvector('english', d.content),
      plainto_tsquery('english', query_text)
    )::float AS text_rank,
    (
      -- Weighted hybrid score: 70% vector + 30% text
      0.7 * (1 - (d.embedding <=> query_embedding)) +
      0.3 * ts_rank(
        to_tsvector('english', d.content),
        plainto_tsquery('english', query_text)
      )
    )::float AS hybrid_score
  FROM documents d
  WHERE
    (filter_locale IS NULL OR d.locale = filter_locale)
    AND d.embedding IS NOT NULL
  ORDER BY hybrid_score DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION hybrid_search_documents IS 'Hybrid search combining vector similarity (70%) and keyword text matching (30%) for improved relevance';
