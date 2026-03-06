-- Align shipping_zones free_shipping_threshold with STORE_DEFAULTS.freeShippingThreshold (€50)
-- Previously set to €75 in some zones; now unified to €50 across all zones.
UPDATE shipping_zones
SET free_shipping_threshold = 50.00
WHERE free_shipping_threshold = 75.00;
