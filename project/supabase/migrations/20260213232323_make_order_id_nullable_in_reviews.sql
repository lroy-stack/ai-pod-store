-- Make order_id nullable in product_reviews table
-- This allows users to submit reviews even if they haven't purchased through an order
ALTER TABLE product_reviews ALTER COLUMN order_id DROP NOT NULL;

-- Update the unique constraint to handle nullable order_id
ALTER TABLE product_reviews DROP CONSTRAINT product_reviews_product_id_user_id_order_id_key;

-- Add a new partial unique index that only applies when order_id is not null
CREATE UNIQUE INDEX product_reviews_product_user_order_unique
  ON product_reviews (product_id, user_id, order_id)
  WHERE order_id IS NOT NULL;

-- Add a unique index for product_id + user_id when order_id is null
-- This prevents duplicate reviews from the same user for the same product (without an order)
CREATE UNIQUE INDEX product_reviews_product_user_unique_no_order
  ON product_reviews (product_id, user_id)
  WHERE order_id IS NULL;
