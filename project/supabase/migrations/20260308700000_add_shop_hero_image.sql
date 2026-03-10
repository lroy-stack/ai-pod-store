-- Add shop-specific hero image to hero_campaigns
-- Separates landing hero image (image_url) from shop hero image (shop_hero_image_url)
ALTER TABLE hero_campaigns ADD COLUMN IF NOT EXISTS shop_hero_image_url TEXT;
