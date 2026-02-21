-- Add font_size and position columns to personalizations table
-- These support the new text-only personalization with position/size presets

ALTER TABLE personalizations
  ADD COLUMN IF NOT EXISTS font_size TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS position TEXT DEFAULT 'bottom';

-- Add personalization_id to cart_items for linking
ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS personalization_id UUID REFERENCES personalizations(id);
