-- Add refund tracking columns to orders table
-- Purpose: Track refund information including Stripe refund IDs, amounts, and retry counts

-- Add stripe_refund_id column with UNIQUE constraint
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS stripe_refund_id varchar(255) UNIQUE;

-- Add refunded_at timestamp
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

-- Add refund_amount_cents for tracking refund amounts
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS refund_amount_cents integer;

-- Add refund_reason for storing why the refund was issued
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS refund_reason text;

-- Add retry_count for tracking refund retry attempts (default 0)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0 NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN orders.stripe_refund_id IS 'Stripe refund ID (re_xxx) - UNIQUE to prevent duplicate refunds';
COMMENT ON COLUMN orders.refunded_at IS 'Timestamp when the refund was processed';
COMMENT ON COLUMN orders.refund_amount_cents IS 'Amount refunded in cents';
COMMENT ON COLUMN orders.refund_reason IS 'Reason for the refund (customer request, defect, etc.)';
COMMENT ON COLUMN orders.retry_count IS 'Number of refund retry attempts (default 0)';
