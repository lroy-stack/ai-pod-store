-- Add Printify retry tracking columns to orders table
-- This allows us to track failed Printify submissions and retry them

ALTER TABLE orders
  ADD COLUMN printify_retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN printify_error TEXT,
  ADD COLUMN printify_last_attempt_at TIMESTAMPTZ;

-- Create index for querying failed orders that need retry
CREATE INDEX idx_orders_printify_retry
  ON orders(printify_retry_count, printify_last_attempt_at)
  WHERE printify_error IS NOT NULL AND status = 'paid';

-- Add comment explaining the retry logic
COMMENT ON COLUMN orders.printify_retry_count IS 'Number of times we attempted to submit this order to Printify';
COMMENT ON COLUMN orders.printify_error IS 'Error message from last failed Printify submission attempt';
COMMENT ON COLUMN orders.printify_last_attempt_at IS 'Timestamp of last Printify submission attempt';
