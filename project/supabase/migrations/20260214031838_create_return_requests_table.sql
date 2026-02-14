-- Return Requests Table
-- Tracks customer return/refund requests for orders

CREATE TABLE return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed')),
  refund_amount_cents INTEGER,
  refund_currency VARCHAR(10) DEFAULT 'usd',
  stripe_refund_id VARCHAR(255),
  admin_notes TEXT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_return_requests_order_id ON return_requests(order_id);
CREATE INDEX idx_return_requests_user_id ON return_requests(user_id);
CREATE INDEX idx_return_requests_status ON return_requests(status);

-- RLS Policies
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own return requests
CREATE POLICY "Users can view their own return requests"
  ON return_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create return requests for their own orders
CREATE POLICY "Users can create return requests for their own orders"
  ON return_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = return_requests.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Admins can view all return requests
CREATE POLICY "Admins can view all return requests"
  ON return_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can update return requests
CREATE POLICY "Admins can update return requests"
  ON return_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_return_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER return_requests_updated_at
  BEFORE UPDATE ON return_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_return_requests_updated_at();
