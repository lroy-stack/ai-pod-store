-- Add personalization surcharge setting to brand_config
-- Optional flat fee added to products with personalization (e.g., +2.50 EUR)
-- Default: NULL (no surcharge)

ALTER TABLE brand_config
ADD COLUMN personalization_surcharge_amount DECIMAL(10, 2) DEFAULT NULL;

COMMENT ON COLUMN brand_config.personalization_surcharge_amount IS
'Optional flat fee (in store base currency) added to products with custom text personalization. NULL = no surcharge.';
