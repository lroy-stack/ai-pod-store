-- Update existing products with Printify IDs for testing
-- This allows end-to-end testing of the Printify order submission flow

UPDATE products
SET printify_id = 'mock-1'
WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE products
SET printify_id = 'mock-2'
WHERE id = '00000000-0000-0000-0000-000000000002';

UPDATE products
SET printify_id = 'mock-3'
WHERE id = '00000000-0000-0000-0000-000000000003';
