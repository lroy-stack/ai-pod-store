-- Prevent users from escalating their own role via direct RLS bypass
-- The API already protects against this (only destructures safe fields),
-- but RLS should be defense-in-depth.

DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM users WHERE id = auth.uid())
  );
