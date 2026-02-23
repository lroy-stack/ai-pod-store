-- Allow public SELECT on active categories
CREATE POLICY categories_public_read ON categories
  FOR SELECT
  USING (is_active = true);
