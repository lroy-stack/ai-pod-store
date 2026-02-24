-- Add double opt-in confirmation columns to newsletter_subscribers (Feature #69)
ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS confirmation_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
