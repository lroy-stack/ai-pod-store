-- Fix currency defaults: USD → EUR
ALTER TABLE users ALTER COLUMN currency SET DEFAULT 'EUR';
ALTER TABLE products ALTER COLUMN currency SET DEFAULT 'eur';
ALTER TABLE orders ALTER COLUMN currency SET DEFAULT 'eur';
ALTER TABLE return_requests ALTER COLUMN refund_currency SET DEFAULT 'eur';

-- Fix CHAR → VARCHAR (users already done in 20260213190000, fix remaining tables)
ALTER TABLE orders ALTER COLUMN locale TYPE VARCHAR(5);
ALTER TABLE documents ALTER COLUMN locale TYPE VARCHAR(5);
ALTER TABLE product_reviews ALTER COLUMN locale TYPE VARCHAR(5);
ALTER TABLE translations ALTER COLUMN locale TYPE VARCHAR(5);

-- Update existing USD records to EUR
UPDATE products SET currency = 'eur' WHERE currency = 'usd';
UPDATE orders SET currency = 'eur' WHERE currency = 'usd';
