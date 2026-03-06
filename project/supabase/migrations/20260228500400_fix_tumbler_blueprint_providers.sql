-- Fix blueprint_id and print_provider_id for the 2 remaining tumblers

-- 404 Dev → Tumbler 20oz BP1927 / P410 (Printful)
-- Silver variant 78458 matches BP1927 SS Tumbler lineup
UPDATE products SET blueprint_id = 1927, print_provider_id = 410
WHERE title = '404 Dev' AND status = 'active' AND blueprint_id IS NULL;

-- Git Reset → Vagabond 20oz BP966 / P86 (The Dream Junction)
-- Black (119530) + White (119531) variants match BP966 Vagabond lineup
UPDATE products SET blueprint_id = 966, print_provider_id = 86
WHERE title = 'Git Reset' AND status = 'active' AND blueprint_id IS NULL;
