-- Fix: Add 'requires_review', 'failed', 'disputed' to orders.status CHECK constraint
-- These statuses are actively used by application code but were missing from the DB constraint:
--   - requires_review: checkout-completed.ts:281, retry-printify-orders, zombie-reaper
--   - failed: order-failed.ts:54 (POD provider production failure)
--   - disputed: dispute-handlers.ts (Stripe chargebacks)

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending', 'paid', 'submitted', 'in_production',
    'shipped', 'delivered', 'cancelled', 'refunded',
    'requires_review', 'failed', 'disputed'
  ));
