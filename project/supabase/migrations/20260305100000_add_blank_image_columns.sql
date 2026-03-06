-- Add blank garment image URL and provider hex color to product_variants.
-- Used by Design Studio to display real blank product images from Printful CDN.
-- Populated by sync-blank-images.mjs script via Printful Catalog API.

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS blank_image_url TEXT,
  ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7);
