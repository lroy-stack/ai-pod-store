-- Populate blueprint_id and print_provider_id for active products that are missing them
-- Based on known product types and their Printify blueprints/providers

-- T-Shirts → BP6 (Gildan 5000) / P26 (Textildruck Europa)
UPDATE products SET blueprint_id = 6, print_provider_id = 26
WHERE title IN ('Absolutely Right', 'Ghost Tee', 'Prism Tee', 'Shadow Tee', 'Vibe Coder', 'Zero Bugs')
AND status = 'active' AND blueprint_id IS NULL;

-- Structured Caps → BP1744 / P410 (Printful)
UPDATE products SET blueprint_id = 1744, print_provider_id = 410
WHERE title IN ('AI Wrote This', 'Dark Mode', 'It Works')
AND status = 'active' AND blueprint_id IS NULL;

-- Beanie → BP1691 / P410
UPDATE products SET blueprint_id = 1691, print_provider_id = 410
WHERE title = 'Vibe Coded' AND status = 'active' AND blueprint_id IS NULL;

-- Dad Hat → BP1729 / P410
UPDATE products SET blueprint_id = 1729, print_provider_id = 410
WHERE title = 'Prompt Me' AND status = 'active' AND blueprint_id IS NULL;

-- Snapback → BP1743 / P410
UPDATE products SET blueprint_id = 1743, print_provider_id = 410
WHERE title = 'Friday Deploy' AND status = 'active' AND blueprint_id IS NULL;

-- Mugs → BP1018 (Two-Tone 11oz) / P26
UPDATE products SET blueprint_id = 1018, print_provider_id = 26
WHERE title IN ('Full Credit', 'Prompt Engineer')
AND status = 'active' AND blueprint_id IS NULL;

-- SS Water Bottle → BP854 / P23 (WOYC)
UPDATE products SET blueprint_id = 854, print_provider_id = 23
WHERE title = 'Refactor Anyway' AND status = 'active' AND blueprint_id IS NULL;
