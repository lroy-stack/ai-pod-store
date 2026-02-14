-- Insert test notification for feature testing
-- This notification will be used to verify the notification bell badge displays correctly

INSERT INTO notifications (
  id,
  user_id,
  type,
  title,
  body,
  is_read,
  created_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM users LIMIT 1),
  'order_shipped',
  'Your order has been shipped!',
  'Your order #12345 has been shipped and is on its way. Track your package to see estimated delivery.',
  FALSE,
  NOW()
)
ON CONFLICT (id) DO NOTHING;
