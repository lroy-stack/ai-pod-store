-- Add multiple test notifications for feature 203 testing
-- These notifications will be used to verify:
-- 1. Clicking an unread notification marks it as read
-- 2. "Mark all as read" button marks all notifications as read

-- Insert 5 unread notifications
INSERT INTO notifications (
  id,
  user_id,
  type,
  title,
  body,
  is_read,
  created_at
)
SELECT
  gen_random_uuid(),
  (SELECT id FROM users LIMIT 1),
  notification_type,
  notification_title,
  notification_body,
  FALSE,
  NOW() - (interval '1 hour' * row_num)
FROM (
  VALUES
    (1, 'order_shipped', 'Order #12345 Shipped', 'Your order has been shipped and is on its way!'),
    (2, 'payment_success', 'Payment Received', 'We have received your payment for order #12346.'),
    (3, 'order_delivered', 'Order Delivered', 'Your order #12344 has been delivered to your address.'),
    (4, 'info', 'New Products Added', 'Check out our new collection of t-shirts and phone cases!'),
    (5, 'payment_failed', 'Payment Failed', 'We could not process your payment. Please update your payment method.')
) AS notifications(row_num, notification_type, notification_title, notification_body)
WHERE NOT EXISTS (
  SELECT 1 FROM notifications WHERE type = notification_type AND title = notification_title
);
