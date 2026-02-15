-- Add printify_status column to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS printify_status VARCHAR(50);

-- Add index for printify_status queries
CREATE INDEX IF NOT EXISTS idx_orders_printify_status ON orders(printify_status);

-- Comment on column
COMMENT ON COLUMN orders.printify_status IS 'Status of the order submission to Printify (submitted, processing, production, shipped, failed, etc.)';
