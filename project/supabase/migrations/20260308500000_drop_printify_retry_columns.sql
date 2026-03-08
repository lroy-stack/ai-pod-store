-- Drop deprecated Printify-specific retry columns (superseded by pod_*)
-- Data already backfilled: pod_retry_count = printify_retry_count (migration 20260306200000)
ALTER TABLE orders DROP COLUMN IF EXISTS printify_retry_count;
ALTER TABLE orders DROP COLUMN IF EXISTS printify_error;
ALTER TABLE orders DROP COLUMN IF EXISTS printify_last_attempt_at;

-- Drop unused index
DROP INDEX IF EXISTS idx_orders_printify_retry;
