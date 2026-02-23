-- Allow service_role full access to categories
CREATE POLICY categories_service_role_all ON categories
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
