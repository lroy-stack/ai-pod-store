-- Fix test user subscription_status that was incorrectly set to 'past_due'
-- This caused a misleading "Payment Required" banner during E2E testing
UPDATE users
SET subscription_status = 'none', tier = 'free'
WHERE email = 'e2e-test@example.com'
  AND subscription_status = 'past_due';
