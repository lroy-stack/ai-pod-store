-- Drop the old search_documents function with match_threshold parameter
-- This resolves the function overloading conflict (PGRST203 error)

DROP FUNCTION IF EXISTS search_documents(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_locale char(5)
);

-- The new version (without match_threshold) remains from migration 20260214141500
