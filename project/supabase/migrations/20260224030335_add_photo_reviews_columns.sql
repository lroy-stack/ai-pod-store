-- Add photo upload support and verified purchase tracking to product_reviews
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;
