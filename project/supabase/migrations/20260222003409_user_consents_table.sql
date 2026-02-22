-- Create user_consents table for GDPR compliance
-- Tracks user consent grants and withdrawals for various purposes

CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('cookies', 'marketing', 'analytics', 'functional', 'personalization')),
  granted BOOLEAN NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON public.user_consents(user_id);

-- Create index on consent_type for analytics
CREATE INDEX IF NOT EXISTS idx_user_consents_type ON public.user_consents(consent_type);

-- Create compound index for latest consent per user per type
CREATE INDEX IF NOT EXISTS idx_user_consents_user_type_timestamp
  ON public.user_consents(user_id, consent_type, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own consent records
CREATE POLICY "Users can view own consents"
  ON public.user_consents
  FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- RLS Policy: Users can insert their own consent records
CREATE POLICY "Users can insert own consents"
  ON public.user_consents
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

-- RLS Policy: Service role can view all consents (for admin/compliance)
CREATE POLICY "Service role can view all consents"
  ON public.user_consents
  FOR SELECT
  USING (
    auth.role() = 'service_role'
  );

-- RLS Policy: Service role can insert consents (for system actions)
CREATE POLICY "Service role can insert consents"
  ON public.user_consents
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
  );

-- Add comment for documentation
COMMENT ON TABLE public.user_consents IS 'GDPR consent tracking - records user consent grants and withdrawals';
COMMENT ON COLUMN public.user_consents.consent_type IS 'Type of consent: cookies, marketing, analytics, functional, personalization';
COMMENT ON COLUMN public.user_consents.granted IS 'true = consent granted, false = consent withdrawn';
COMMENT ON COLUMN public.user_consents.timestamp IS 'When the consent action occurred';
COMMENT ON COLUMN public.user_consents.ip_address IS 'IP address of the user when consent was given/withdrawn';
COMMENT ON COLUMN public.user_consents.user_agent IS 'User agent string for audit trail';
