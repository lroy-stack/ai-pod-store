-- Update Warm Slate theme fonts from Playfair Display + DM Sans to Inter
-- Modern e-commerce typography (Apple/Samsung style)
UPDATE public.store_themes
SET fonts = jsonb_build_object(
  'heading', 'Inter',
  'body', 'Inter',
  'mono', 'JetBrains Mono'
)
WHERE name = 'Warm Slate' AND is_active = true;
