-- Recategorize products from parent categories to specific subcategories
-- based on title keyword matching (mirrors inferCategorySlug() in printify-sync.ts)
-- Only reassigns products that currently sit at a PARENT category level.

DO $$
DECLARE
  -- Parent category IDs
  apparel_id UUID;
  drinkware_id UUID;
  home_decor_id UUID;
  accessories_id UUID;
  kids_id UUID;
  kitchen_id UUID;
  stationery_id UUID;
  games_id UUID;

  -- Subcategory IDs (apparel)
  tshirts_id UUID;
  hoodies_id UUID;
  sweatshirts_id UUID;
  long_sleeves_id UUID;
  tank_tops_id UUID;
  outerwear_id UUID;
  bottoms_id UUID;

  -- Subcategory IDs (drinkware)
  mugs_id UUID;
  bottles_tumblers_id UUID;
  glassware_id UUID;

  -- Subcategory IDs (home-decor)
  posters_id UUID;
  wall_art_id UUID;
  canvas_id UUID;
  blankets_id UUID;
  pillows_id UUID;
  rugs_id UUID;

  -- Subcategory IDs (accessories)
  bags_id UUID;
  hats_id UUID;
  phone_cases_id UUID;
  stickers_id UUID;
  jewelry_id UUID;
  socks_id UUID;
  mouse_pads_id UUID;
  tech_accessories_id UUID;

  -- Subcategory IDs (kids)
  kids_tshirts_id UUID;
  kids_sweatshirts_id UUID;
  baby_clothing_id UUID;

  -- Subcategory IDs (kitchen)
  kitchen_towels_id UUID;

  -- Subcategory IDs (stationery)
  journals_id UUID;
  notebooks_id UUID;
  postcards_id UUID;

  -- Subcategory IDs (games)
  puzzles_id UUID;

BEGIN
  -- Fetch parent IDs
  SELECT id INTO apparel_id FROM categories WHERE slug = 'apparel';
  SELECT id INTO drinkware_id FROM categories WHERE slug = 'drinkware';
  SELECT id INTO home_decor_id FROM categories WHERE slug = 'home-decor';
  SELECT id INTO accessories_id FROM categories WHERE slug = 'accessories';
  SELECT id INTO kids_id FROM categories WHERE slug = 'kids';
  SELECT id INTO kitchen_id FROM categories WHERE slug = 'kitchen';
  SELECT id INTO stationery_id FROM categories WHERE slug = 'stationery';
  SELECT id INTO games_id FROM categories WHERE slug = 'games';

  -- Fetch subcategory IDs
  SELECT id INTO tshirts_id FROM categories WHERE slug = 't-shirts';
  SELECT id INTO hoodies_id FROM categories WHERE slug = 'hoodies';
  SELECT id INTO sweatshirts_id FROM categories WHERE slug = 'sweatshirts';
  SELECT id INTO long_sleeves_id FROM categories WHERE slug = 'long-sleeves';
  SELECT id INTO tank_tops_id FROM categories WHERE slug = 'tank-tops';
  SELECT id INTO outerwear_id FROM categories WHERE slug = 'outerwear';
  SELECT id INTO bottoms_id FROM categories WHERE slug = 'bottoms';
  SELECT id INTO mugs_id FROM categories WHERE slug = 'mugs';
  SELECT id INTO bottles_tumblers_id FROM categories WHERE slug = 'bottles-tumblers';
  SELECT id INTO glassware_id FROM categories WHERE slug = 'glassware';
  SELECT id INTO posters_id FROM categories WHERE slug = 'posters';
  SELECT id INTO wall_art_id FROM categories WHERE slug = 'wall-art';
  SELECT id INTO canvas_id FROM categories WHERE slug = 'canvas';
  SELECT id INTO blankets_id FROM categories WHERE slug = 'blankets';
  SELECT id INTO pillows_id FROM categories WHERE slug = 'pillows';
  SELECT id INTO rugs_id FROM categories WHERE slug = 'rugs';
  SELECT id INTO bags_id FROM categories WHERE slug = 'bags';
  SELECT id INTO hats_id FROM categories WHERE slug = 'hats';
  SELECT id INTO phone_cases_id FROM categories WHERE slug = 'phone-cases';
  SELECT id INTO stickers_id FROM categories WHERE slug = 'stickers';
  SELECT id INTO jewelry_id FROM categories WHERE slug = 'jewelry';
  SELECT id INTO socks_id FROM categories WHERE slug = 'socks';
  SELECT id INTO mouse_pads_id FROM categories WHERE slug = 'mouse-pads';
  SELECT id INTO tech_accessories_id FROM categories WHERE slug = 'tech-accessories';
  SELECT id INTO kids_tshirts_id FROM categories WHERE slug = 'kids-tshirts';
  SELECT id INTO kids_sweatshirts_id FROM categories WHERE slug = 'kids-sweatshirts';
  SELECT id INTO baby_clothing_id FROM categories WHERE slug = 'baby-clothing';
  SELECT id INTO kitchen_towels_id FROM categories WHERE slug = 'kitchen-towels';
  SELECT id INTO journals_id FROM categories WHERE slug = 'journals';
  SELECT id INTO notebooks_id FROM categories WHERE slug = 'notebooks';
  SELECT id INTO postcards_id FROM categories WHERE slug = 'postcards';
  SELECT id INTO puzzles_id FROM categories WHERE slug = 'puzzles';

  -- =============================================
  -- DRINKWARE → subcategories (most specific first)
  -- =============================================
  IF drinkware_id IS NOT NULL AND mugs_id IS NOT NULL THEN
    UPDATE products SET category_id = mugs_id
    WHERE category_id = drinkware_id
      AND (title ILIKE '%mug%' OR title ILIKE '%cup%');
  END IF;

  IF drinkware_id IS NOT NULL AND bottles_tumblers_id IS NOT NULL THEN
    UPDATE products SET category_id = bottles_tumblers_id
    WHERE category_id = drinkware_id
      AND (title ILIKE '%tumbler%' OR title ILIKE '%bottle%' OR title ILIKE '%water bottle%');
  END IF;

  IF drinkware_id IS NOT NULL AND glassware_id IS NOT NULL THEN
    UPDATE products SET category_id = glassware_id
    WHERE category_id = drinkware_id
      AND (title ILIKE '%glass%' OR title ILIKE '%wine glass%' OR title ILIKE '%pint glass%' OR title ILIKE '%shot glass%');
  END IF;

  -- =============================================
  -- APPAREL → subcategories (most specific first)
  -- =============================================

  -- Long sleeves before generic t-shirts
  IF apparel_id IS NOT NULL AND long_sleeves_id IS NOT NULL THEN
    UPDATE products SET category_id = long_sleeves_id
    WHERE category_id = apparel_id
      AND (title ILIKE '%long sleeve%' OR title ILIKE '%longsleeve%');
  END IF;

  -- Tank tops
  IF apparel_id IS NOT NULL AND tank_tops_id IS NOT NULL THEN
    UPDATE products SET category_id = tank_tops_id
    WHERE category_id = apparel_id
      AND (title ILIKE '%tank top%' OR title ILIKE '%tanktop%' OR title ILIKE '%tank %');
  END IF;

  -- Outerwear
  IF apparel_id IS NOT NULL AND outerwear_id IS NOT NULL THEN
    UPDATE products SET category_id = outerwear_id
    WHERE category_id = apparel_id
      AND (title ILIKE '%jacket%' OR title ILIKE '%windbreaker%' OR title ILIKE '%coat%' OR title ILIKE '%outerwear%');
  END IF;

  -- Bottoms
  IF apparel_id IS NOT NULL AND bottoms_id IS NOT NULL THEN
    UPDATE products SET category_id = bottoms_id
    WHERE category_id = apparel_id
      AND (title ILIKE '%shorts%' OR title ILIKE '%pants%' OR title ILIKE '%legging%' OR title ILIKE '%jogger%' OR title ILIKE '%trouser%');
  END IF;

  -- Hoodies
  IF apparel_id IS NOT NULL AND hoodies_id IS NOT NULL THEN
    UPDATE products SET category_id = hoodies_id
    WHERE category_id = apparel_id
      AND (title ILIKE '%hoodie%' OR title ILIKE '%pullover%');
  END IF;

  -- Sweatshirts
  IF apparel_id IS NOT NULL AND sweatshirts_id IS NOT NULL THEN
    UPDATE products SET category_id = sweatshirts_id
    WHERE category_id = apparel_id
      AND (title ILIKE '%sweatshirt%' OR title ILIKE '%sweater%' OR title ILIKE '%crewneck%');
  END IF;

  -- T-shirts (broadest apparel — last in the chain)
  IF apparel_id IS NOT NULL AND tshirts_id IS NOT NULL THEN
    UPDATE products SET category_id = tshirts_id
    WHERE category_id = apparel_id
      AND (title ILIKE '%t-shirt%' OR title ILIKE '%tshirt%' OR title ILIKE '%tee %' OR title ILIKE '% tee' OR title ILIKE '%unisex%' OR title ILIKE '%shirt%');
  END IF;

  -- =============================================
  -- HOME-DECOR → subcategories
  -- =============================================
  IF home_decor_id IS NOT NULL AND canvas_id IS NOT NULL THEN
    UPDATE products SET category_id = canvas_id
    WHERE category_id = home_decor_id
      AND (title ILIKE '%canvas%');
  END IF;

  IF home_decor_id IS NOT NULL AND blankets_id IS NOT NULL THEN
    UPDATE products SET category_id = blankets_id
    WHERE category_id = home_decor_id
      AND (title ILIKE '%blanket%' OR title ILIKE '%throw%' OR title ILIKE '%fleece%');
  END IF;

  IF home_decor_id IS NOT NULL AND pillows_id IS NOT NULL THEN
    UPDATE products SET category_id = pillows_id
    WHERE category_id = home_decor_id
      AND (title ILIKE '%pillow%' OR title ILIKE '%cushion%');
  END IF;

  IF home_decor_id IS NOT NULL AND rugs_id IS NOT NULL THEN
    UPDATE products SET category_id = rugs_id
    WHERE category_id = home_decor_id
      AND (title ILIKE '%rug%' OR title ILIKE '%bath mat%' OR title ILIKE '%door mat%');
  END IF;

  IF home_decor_id IS NOT NULL AND wall_art_id IS NOT NULL THEN
    UPDATE products SET category_id = wall_art_id
    WHERE category_id = home_decor_id
      AND (title ILIKE '%wall art%' OR title ILIKE '%wall print%');
  END IF;

  IF home_decor_id IS NOT NULL AND posters_id IS NOT NULL THEN
    UPDATE products SET category_id = posters_id
    WHERE category_id = home_decor_id
      AND (title ILIKE '%poster%' OR title ILIKE '%print%');
  END IF;

  -- =============================================
  -- ACCESSORIES → subcategories
  -- =============================================
  IF accessories_id IS NOT NULL AND stickers_id IS NOT NULL THEN
    UPDATE products SET category_id = stickers_id
    WHERE category_id = accessories_id
      AND (title ILIKE '%sticker%' OR title ILIKE '%decal%');
  END IF;

  IF accessories_id IS NOT NULL AND phone_cases_id IS NOT NULL THEN
    UPDATE products SET category_id = phone_cases_id
    WHERE category_id = accessories_id
      AND (title ILIKE '%phone case%' OR title ILIKE '%iphone%' OR title ILIKE '%samsung%');
  END IF;

  IF accessories_id IS NOT NULL AND jewelry_id IS NOT NULL THEN
    UPDATE products SET category_id = jewelry_id
    WHERE category_id = accessories_id
      AND (title ILIKE '%jewelry%' OR title ILIKE '%necklace%' OR title ILIKE '%bracelet%' OR title ILIKE '%earring%');
  END IF;

  IF accessories_id IS NOT NULL AND socks_id IS NOT NULL THEN
    UPDATE products SET category_id = socks_id
    WHERE category_id = accessories_id
      AND (title ILIKE '%sock%');
  END IF;

  IF accessories_id IS NOT NULL AND mouse_pads_id IS NOT NULL THEN
    UPDATE products SET category_id = mouse_pads_id
    WHERE category_id = accessories_id
      AND (title ILIKE '%mouse pad%' OR title ILIKE '%mousepad%');
  END IF;

  IF accessories_id IS NOT NULL AND tech_accessories_id IS NOT NULL THEN
    UPDATE products SET category_id = tech_accessories_id
    WHERE category_id = accessories_id
      AND (title ILIKE '%laptop sleeve%' OR title ILIKE '%airpods%' OR title ILIKE '%charger%');
  END IF;

  IF accessories_id IS NOT NULL AND bags_id IS NOT NULL THEN
    UPDATE products SET category_id = bags_id
    WHERE category_id = accessories_id
      AND (title ILIKE '%tote%' OR title ILIKE '%bag%' OR title ILIKE '%backpack%' OR title ILIKE '%duffle%');
  END IF;

  IF accessories_id IS NOT NULL AND hats_id IS NOT NULL THEN
    UPDATE products SET category_id = hats_id
    WHERE category_id = accessories_id
      AND (title ILIKE '%hat%' OR title ILIKE '%cap%' OR title ILIKE '%beanie%' OR title ILIKE '%snapback%' OR title ILIKE '%trucker%');
  END IF;

  -- =============================================
  -- KIDS → subcategories
  -- =============================================
  IF kids_id IS NOT NULL AND kids_tshirts_id IS NOT NULL THEN
    UPDATE products SET category_id = kids_tshirts_id
    WHERE category_id = kids_id
      AND (title ILIKE '%t-shirt%' OR title ILIKE '%tshirt%' OR title ILIKE '%tee%');
  END IF;

  IF kids_id IS NOT NULL AND kids_sweatshirts_id IS NOT NULL THEN
    UPDATE products SET category_id = kids_sweatshirts_id
    WHERE category_id = kids_id
      AND (title ILIKE '%sweatshirt%' OR title ILIKE '%sweater%' OR title ILIKE '%hoodie%');
  END IF;

  IF kids_id IS NOT NULL AND baby_clothing_id IS NOT NULL THEN
    UPDATE products SET category_id = baby_clothing_id
    WHERE category_id = kids_id
      AND (title ILIKE '%baby%' OR title ILIKE '%onesie%' OR title ILIKE '%infant%' OR title ILIKE '%bodysuit%');
  END IF;

  -- =============================================
  -- KITCHEN → subcategories
  -- =============================================
  IF kitchen_id IS NOT NULL AND kitchen_towels_id IS NOT NULL THEN
    UPDATE products SET category_id = kitchen_towels_id
    WHERE category_id = kitchen_id
      AND (title ILIKE '%towel%' OR title ILIKE '%dish towel%' OR title ILIKE '%tea towel%');
  END IF;

  -- =============================================
  -- STATIONERY → subcategories
  -- =============================================
  IF stationery_id IS NOT NULL AND journals_id IS NOT NULL THEN
    UPDATE products SET category_id = journals_id
    WHERE category_id = stationery_id
      AND (title ILIKE '%journal%' OR title ILIKE '%diary%');
  END IF;

  IF stationery_id IS NOT NULL AND notebooks_id IS NOT NULL THEN
    UPDATE products SET category_id = notebooks_id
    WHERE category_id = stationery_id
      AND (title ILIKE '%notebook%' OR title ILIKE '%notepad%');
  END IF;

  IF stationery_id IS NOT NULL AND postcards_id IS NOT NULL THEN
    UPDATE products SET category_id = postcards_id
    WHERE category_id = stationery_id
      AND (title ILIKE '%postcard%' OR title ILIKE '%greeting card%');
  END IF;

  -- =============================================
  -- GAMES → subcategories
  -- =============================================
  IF games_id IS NOT NULL AND puzzles_id IS NOT NULL THEN
    UPDATE products SET category_id = puzzles_id
    WHERE category_id = games_id
      AND (title ILIKE '%puzzle%' OR title ILIKE '%jigsaw%');
  END IF;

END $$;
