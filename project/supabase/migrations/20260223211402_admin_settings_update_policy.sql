-- Admin can update settings
CREATE POLICY "Admin can update settings"
  ON public.admin_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
