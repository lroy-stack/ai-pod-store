-- Add trade register fields to legal_settings
-- Required for proper Imprint/Legal Notice pages (especially for EU/German "Impressum")

-- Update existing legal_settings record to include trade register info
UPDATE public.legal_settings
SET settings = settings || jsonb_build_object(
  'trade_register_court', 'Amtsgericht San Francisco',
  'trade_register_number', 'HRB 123456'
)
WHERE settings ? 'company_name';

-- Update comment to reflect new fields
COMMENT ON COLUMN public.legal_settings.settings IS 'JSONB object containing: company_name, company_address, tax_id, company_email, dpo_name, dpo_email, trade_register_court, trade_register_number, privacy_policy_url, terms_of_service_url, cookie_policy_url';
