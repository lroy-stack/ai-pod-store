-- Add payment intent to test order for return/refund testing
-- Using a test mode payment intent ID from Stripe

UPDATE orders
SET stripe_payment_intent_id = 'pi_3QjTestPaymentIntent123'
WHERE id = '00000000-0000-0000-0000-000000000100';
