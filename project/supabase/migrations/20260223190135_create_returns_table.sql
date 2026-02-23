-- Create returns table for product return lifecycle tracking
-- Purpose: Track the complete lifecycle of product returns from request to completion
-- Features: Full status lifecycle, foreign keys, tracking numbers

CREATE TABLE IF NOT EXISTS returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(30) NOT NULL DEFAULT 'return_requested',
  reason text NOT NULL,
  admin_notes text,
  return_tracking_number varchar(255),
  refund_amount_cents integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT returns_status_check CHECK (
    status IN (
      'return_requested',
      'return_approved',
      'item_shipped',
      'item_received',
      'return_completed',
      'rejected',
      'expired'
    )
  )
);

-- Create index for order lookups
CREATE INDEX IF NOT EXISTS idx_returns_order
  ON returns(order_id);

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_returns_status
  ON returns(status, created_at DESC);

-- Create index for customer lookups
CREATE INDEX IF NOT EXISTS idx_returns_customer
  ON returns(customer_id, created_at DESC);

-- Enable RLS (customers can only see their own returns)
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

-- Customers can view their own returns
CREATE POLICY "Customers can view their own returns"
  ON returns
  FOR SELECT
  USING (auth.uid() = customer_id);

-- Customers can create returns for their own orders
CREATE POLICY "Customers can create their own returns"
  ON returns
  FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = returns.order_id
      AND orders.user_id = customer_id
    )
  );

-- Service role has full access
CREATE POLICY "Service role full access"
  ON returns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can view and update all returns
CREATE POLICY "Admins can view all returns"
  ON returns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admins can update returns"
  ON returns
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'staff')
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER returns_updated_at
  BEFORE UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION update_returns_updated_at();

-- Add comments for documentation
COMMENT ON TABLE returns IS 'Tracks product returns through their complete lifecycle from request to resolution';
COMMENT ON COLUMN returns.status IS 'Return status: return_requested, return_approved, item_shipped, item_received, return_completed, rejected, expired';
COMMENT ON COLUMN returns.return_tracking_number IS 'Tracking number for the return shipment from customer to warehouse';
COMMENT ON COLUMN returns.resolved_by IS 'User ID of admin/staff who resolved the return';
COMMENT ON COLUMN returns.resolved_at IS 'Timestamp when return was completed or rejected';
