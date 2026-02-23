-- Create legal_settings table for company legal information
-- This table stores GDPR-compliant company information used across legal pages

CREATE TABLE IF NOT EXISTS public.legal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_legal_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER legal_settings_updated_at
  BEFORE UPDATE ON public.legal_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_legal_settings_updated_at();

-- Enable RLS
ALTER TABLE public.legal_settings ENABLE ROW LEVEL SECURITY;

-- Public read access (for legal pages on frontend)
CREATE POLICY "Public can read legal settings"
  ON public.legal_settings
  FOR SELECT
  USING (true);

-- Admin-only update access (managed via admin API)
CREATE POLICY "Admins can update legal settings"
  ON public.legal_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Seed with default values
INSERT INTO public.legal_settings (settings)
VALUES (
  jsonb_build_object(
    'company_name', 'PodClaw Store',
    'company_address', '123 Commerce Street, San Francisco, CA 94105, USA',
    'tax_id', 'XX-XXXXXXX',
    'company_email', 'legal@podstore.local',
    'dpo_name', 'Data Protection Officer',
    'dpo_email', 'dpo@podstore.local',
    'privacy_policy_url', '/privacy',
    'terms_of_service_url', '/terms',
    'cookie_policy_url', '/privacy#cookies'
  )
)
ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON TABLE public.legal_settings IS 'Stores company legal information (GDPR compliance, contact details, legal page references)';
COMMENT ON COLUMN public.legal_settings.settings IS 'JSONB object containing: company_name, company_address, tax_id, company_email, dpo_name, dpo_email, privacy_policy_url, terms_of_service_url, cookie_policy_url';
