-- Add payment_method column to orders table
-- This stores the payment method type from Stripe (card, crypto, etc.)

ALTER TABLE orders
ADD COLUMN payment_method VARCHAR(50);

-- Add comment explaining the column
COMMENT ON COLUMN orders.payment_method IS 'Payment method type from Stripe (card, crypto, etc.)';

-- Index for filtering by payment method
CREATE INDEX idx_orders_payment_method ON orders(payment_method) WHERE payment_method IS NOT NULL;
