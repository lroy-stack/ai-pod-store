-- Create shipping_zones table for zip code-based shipping estimates
CREATE TABLE IF NOT EXISTS shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL,
  zip_pattern VARCHAR(20),
  state_code VARCHAR(5),
  base_rate DECIMAL(10,2) NOT NULL,
  per_item_rate DECIMAL(10,2) DEFAULT 0,
  free_shipping_threshold DECIMAL(10,2),
  estimated_days_min INTEGER DEFAULT 3,
  estimated_days_max INTEGER DEFAULT 7,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on country and zip pattern for fast lookups
CREATE INDEX idx_shipping_zones_country_zip ON shipping_zones(country_code, zip_pattern);

-- Insert sample shipping zones for US
INSERT INTO shipping_zones (country_code, zip_pattern, state_code, base_rate, per_item_rate, free_shipping_threshold, estimated_days_min, estimated_days_max) VALUES
-- US Standard rates
('US', '%', NULL, 5.99, 1.50, 50.00, 5, 7),
-- US Fast zones (major cities)
('US', '100%', 'NY', 7.99, 2.00, 75.00, 2, 4),
('US', '900%', 'CA', 7.99, 2.00, 75.00, 2, 4),
('US', '600%', 'IL', 7.99, 2.00, 75.00, 2, 4),
-- Remote zones (higher rates)
('US', '995%', 'AK', 12.99, 3.50, 100.00, 7, 14),
('US', '996%', 'HI', 12.99, 3.50, 100.00, 7, 14);

-- Insert sample shipping zones for other countries
INSERT INTO shipping_zones (country_code, base_rate, per_item_rate, free_shipping_threshold, estimated_days_min, estimated_days_max) VALUES
('CA', 8.99, 2.50, 60.00, 5, 10),
('GB', 9.99, 3.00, 75.00, 7, 14),
('DE', 9.99, 3.00, 75.00, 7, 14),
('FR', 9.99, 3.00, 75.00, 7, 14),
('ES', 9.99, 3.00, 75.00, 7, 14),
('IT', 9.99, 3.00, 75.00, 7, 14),
('AU', 14.99, 4.00, 100.00, 10, 21),
('JP', 14.99, 4.00, 100.00, 10, 21);

-- Enable RLS
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;

-- Public read policy (everyone can see shipping zones)
CREATE POLICY shipping_zones_read_policy ON shipping_zones
  FOR SELECT
  USING (active = true);
