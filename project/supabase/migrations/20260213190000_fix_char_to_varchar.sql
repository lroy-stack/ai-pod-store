-- Fix CHAR fields to VARCHAR to avoid space-padding issues
-- CHAR fields in PostgreSQL are space-padded, which causes issues with string comparisons

-- First, update existing data to trim whitespace
UPDATE users SET locale = TRIM(locale), currency = TRIM(currency);

-- Then, change column types to VARCHAR
ALTER TABLE users
  ALTER COLUMN locale TYPE VARCHAR(5),
  ALTER COLUMN currency TYPE VARCHAR(3);
