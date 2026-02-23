-- Admin can read settings
CREATE POLICY "Admin can read settings"
  ON public.admin_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
