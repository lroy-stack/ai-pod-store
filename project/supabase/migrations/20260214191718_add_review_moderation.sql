-- Add moderation columns to product_reviews table
ALTER TABLE product_reviews
  ADD COLUMN moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN moderation_notes TEXT,
  ADD COLUMN moderated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN moderated_at TIMESTAMPTZ;

-- Create index for faster moderation queue queries
CREATE INDEX idx_product_reviews_moderation_status ON product_reviews(moderation_status);
CREATE INDEX idx_product_reviews_created_at ON product_reviews(created_at DESC);
