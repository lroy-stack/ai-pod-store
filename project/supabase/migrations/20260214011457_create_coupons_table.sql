-- Create coupons table for discount codes
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  discount_type varchar(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value decimal(10, 2) NOT NULL CHECK (discount_value > 0),
  min_purchase_amount decimal(10, 2),
  max_discount_amount decimal(10, 2),
  usage_limit integer,
  times_used integer DEFAULT 0,
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create index on code for fast lookups
CREATE INDEX idx_coupons_code ON coupons(code);

-- Create index on active and valid dates for filtering valid coupons
CREATE INDEX idx_coupons_active_valid ON coupons(active, valid_from, valid_until);

-- Insert some test coupons
INSERT INTO coupons (code, discount_type, discount_value, min_purchase_amount, max_discount_amount, usage_limit, active, valid_until)
VALUES
  ('WELCOME10', 'percentage', 10.00, 25.00, NULL, NULL, true, '2027-12-31 23:59:59+00'),
  ('SAVE5', 'fixed_amount', 5.00, 15.00, NULL, NULL, true, '2027-12-31 23:59:59+00'),
  ('FREESHIP', 'fixed_amount', 10.00, 50.00, NULL, 100, true, '2027-12-31 23:59:59+00'),
  ('BIGDEAL', 'percentage', 20.00, 100.00, 50.00, 50, true, '2027-12-31 23:59:59+00');

-- Enable RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Policy: anyone can read active coupons (for validation)
CREATE POLICY "Anyone can read active coupons"
  ON coupons
  FOR SELECT
  USING (active = true);

-- Policy: only authenticated users can use service_role to update (for incrementing times_used)
-- This will be handled by the API route with service role client
