ALTER TABLE return_requests
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS tracking_carrier TEXT,
  ADD COLUMN IF NOT EXISTS customer_shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS item_received_at TIMESTAMPTZ;
