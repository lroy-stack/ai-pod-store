-- Add gift_message column to orders table
-- Free feature from Printify, stored per-order from checkout

ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_message TEXT;
