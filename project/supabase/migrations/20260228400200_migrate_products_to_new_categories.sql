-- SKAPARA Category Restructuring Phase B: Migrate products to new categories
-- Assigns products to correct subcategories based on blueprint_id

DO $$
DECLARE
  cat_pullover UUID;
  cat_zip UUID;
  cat_crewnecks UUID;
  cat_caps UUID;
  cat_snapbacks UUID;
  cat_dad_hats UUID;
  cat_5panel UUID;
  cat_beanies UUID;
  cat_bucket UUID;
  cat_bottles UUID;
  cat_tumblers UUID;
  cat_desk_mats UUID;
  cat_laptop UUID;
  cat_tshirts UUID;
  cat_longsleeves UUID;
BEGIN
  -- Look up new category IDs
  SELECT id INTO cat_pullover FROM public.categories WHERE slug = 'pullover-hoodies';
  SELECT id INTO cat_zip FROM public.categories WHERE slug = 'zip-hoodies';
  SELECT id INTO cat_crewnecks FROM public.categories WHERE slug = 'crewnecks';
  SELECT id INTO cat_caps FROM public.categories WHERE slug = 'caps';
  SELECT id INTO cat_snapbacks FROM public.categories WHERE slug = 'snapbacks';
  SELECT id INTO cat_dad_hats FROM public.categories WHERE slug = 'dad-hats';
  SELECT id INTO cat_5panel FROM public.categories WHERE slug = '5-panel-caps';
  SELECT id INTO cat_beanies FROM public.categories WHERE slug = 'beanies';
  SELECT id INTO cat_bucket FROM public.categories WHERE slug = 'bucket-hats';
  SELECT id INTO cat_bottles FROM public.categories WHERE slug = 'bottles';
  SELECT id INTO cat_tumblers FROM public.categories WHERE slug = 'tumblers';
  SELECT id INTO cat_desk_mats FROM public.categories WHERE slug = 'desk-mats';
  SELECT id INTO cat_laptop FROM public.categories WHERE slug = 'laptop-sleeves';
  SELECT id INTO cat_tshirts FROM public.categories WHERE slug = 't-shirts';
  SELECT id INTO cat_longsleeves FROM public.categories WHERE slug = 'long-sleeves';

  -- T-Shirts: BP 6, 145
  UPDATE public.products SET category_id = cat_tshirts
  WHERE blueprint_id IN (6, 145) AND status != 'deleted';

  -- Pullover Hoodies: BP 77, 793
  UPDATE public.products SET category_id = cat_pullover
  WHERE blueprint_id IN (77, 793) AND status != 'deleted';

  -- Zip-Up Hoodies: BP 455
  UPDATE public.products SET category_id = cat_zip
  WHERE blueprint_id = 455 AND status != 'deleted';

  -- Crewneck Sweatshirts: BP 49, 457
  UPDATE public.products SET category_id = cat_crewnecks
  WHERE blueprint_id IN (49, 457) AND status != 'deleted';

  -- Long Sleeves: BP 879, 1192
  UPDATE public.products SET category_id = cat_longsleeves
  WHERE blueprint_id IN (879, 1192) AND status != 'deleted';

  -- Caps: BP 1744, 1128
  UPDATE public.products SET category_id = cat_caps
  WHERE blueprint_id IN (1744, 1128) AND status != 'deleted';

  -- Snapbacks: BP 1108
  UPDATE public.products SET category_id = cat_snapbacks
  WHERE blueprint_id = 1108 AND status != 'deleted';

  -- Dad Hats: BP 1447
  UPDATE public.products SET category_id = cat_dad_hats
  WHERE blueprint_id = 1447 AND status != 'deleted';

  -- 5-Panel Caps: BP 1446
  UPDATE public.products SET category_id = cat_5panel
  WHERE blueprint_id = 1446 AND status != 'deleted';

  -- Beanies: BP 1691
  UPDATE public.products SET category_id = cat_beanies
  WHERE blueprint_id = 1691 AND status != 'deleted';

  -- Bucket Hats: BP 1910
  UPDATE public.products SET category_id = cat_bucket
  WHERE blueprint_id = 1910 AND status != 'deleted';

  -- Bottles: BP 482, 854
  UPDATE public.products SET category_id = cat_bottles
  WHERE blueprint_id IN (482, 854) AND status != 'deleted';

  -- Tumblers: BP 353, 693
  UPDATE public.products SET category_id = cat_tumblers
  WHERE blueprint_id IN (353, 693) AND status != 'deleted';

  -- Desk Mats: BP 969
  UPDATE public.products SET category_id = cat_desk_mats
  WHERE blueprint_id = 969 AND status != 'deleted';

  -- Laptop Sleeves: BP 429
  UPDATE public.products SET category_id = cat_laptop
  WHERE blueprint_id = 429 AND status != 'deleted';

  -- Also update the legacy 'category' VARCHAR column to match new slugs
  UPDATE public.products p SET category = c.slug
  FROM public.categories c
  WHERE p.category_id = c.id AND p.status != 'deleted';
END $$;
