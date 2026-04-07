/**
 * Category inference — map product title to category slug.
 * Copied VERBATIM from printify-sync.ts (provider-agnostic, operates on title string only).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Infer category slug from product title based on keywords.
 * Returns the category slug that matches the categories table.
 *
 * @param title - Product title
 * @returns Category slug (apparel, mugs, stickers, etc.)
 */
export function inferCategorySlug(title: string): string {
  const t = title.toLowerCase()

  // --- Most specific subcategories first ---

  // Stationery subcategories
  if (['journal', 'diary'].some(k => t.includes(k))) return 'journals'
  if (['notebook', 'notepad'].some(k => t.includes(k))) return 'notebooks'
  if (['postcard', 'greeting card'].some(k => t.includes(k))) return 'postcards'

  // Home Decor subcategories
  if (['canvas print', 'canvas'].some(k => t.includes(k))) return 'canvas'
  if (['blanket', 'throw blanket', 'fleece blanket'].some(k => t.includes(k))) return 'blankets'
  if (['pillow', 'cushion'].some(k => t.includes(k))) return 'pillows'
  if (['rug', 'bath mat', 'door mat'].some(k => t.includes(k))) return 'rugs'
  if (['poster', 'print', 'wall art'].some(k => t.includes(k))) return 'posters'

  // Drinkware subcategories
  if (['mug', 'cup'].some(k => t.includes(k))) return 'mugs'
  if (['tumbler'].some(k => t.includes(k))) return 'tumblers'
  if (['bottle', 'water bottle'].some(k => t.includes(k))) return 'bottles'
  if (['glass', 'wine glass', 'pint glass', 'shot glass'].some(k => t.includes(k))) return 'glassware'

  // Kitchen subcategory
  if (['kitchen towel', 'dish towel', 'tea towel'].some(k => t.includes(k))) return 'kitchen-towels'

  // Games subcategory
  if (['puzzle', 'jigsaw'].some(k => t.includes(k))) return 'puzzles'

  // Accessories subcategories
  if (['sticker', 'decal'].some(k => t.includes(k))) return 'stickers'
  if (['phone case', 'iphone', 'samsung'].some(k => t.includes(k))) return 'phone-cases'
  if (['jewelry', 'necklace', 'bracelet', 'earring', 'ring'].some(k => t.includes(k))) return 'jewelry'
  if (['sock', 'socks'].some(k => t.includes(k))) return 'socks'
  if (['mouse pad', 'mousepad'].some(k => t.includes(k))) return 'mouse-pads'
  if (['desk mat', 'gaming mat', 'gaming pad', 'desk pad'].some(k => t.includes(k))) return 'desk-mats'
  if (['laptop sleeve', 'laptop case'].some(k => t.includes(k))) return 'laptop-sleeves'

  // Kids subcategories (must be before generic apparel)
  if (['kids t-shirt', 'kids tee', 'toddler tee', 'toddler t-shirt'].some(k => t.includes(k))) return 'kids-tshirts'
  if (['kids sweatshirt', 'kids sweater'].some(k => t.includes(k))) return 'kids-sweatshirts'
  if (['baby onesie', 'baby bodysuit', 'infant'].some(k => t.includes(k))) return 'baby-clothing'

  // Sportswear subcategories (must be before generic apparel)
  if (['sports bra', 'activewear', 'athletic', 'gym', 'fitness'].some(k => t.includes(k))) return 'activewear'
  if (['swimsuit', 'swimwear', 'swim trunk', 'bikini'].some(k => t.includes(k))) return 'swimwear'

  // Apparel subcategories
  if (['long sleeve', 'longsleeve'].some(k => t.includes(k))) return 'long-sleeves'
  if (['tank top', 'tanktop', 'tank'].some(k => t.includes(k))) return 'tank-tops'
  if (['jacket', 'windbreaker', 'coat', 'outerwear'].some(k => t.includes(k))) return 'outerwear'
  if (['shorts', 'pants', 'legging', 'jogger', 'trouser'].some(k => t.includes(k))) return 'bottoms'
  if (['zip-up hoodie', 'zip hoodie', 'zip up hoodie', 'zip-up'].some(k => t.includes(k))) return 'zip-hoodies'
  if (['hoodie', 'pullover hoodie', 'pullover'].some(k => t.includes(k))) return 'pullover-hoodies'
  if (['crewneck', 'crew neck'].some(k => t.includes(k))) return 'crewnecks'
  if (['sweatshirt', 'sweater'].some(k => t.includes(k))) return 'crewnecks'
  if (['t-shirt', 'tee', 'tshirt'].some(k => t.includes(k))) return 't-shirts'

  // Headwear subcategories
  if (['beanie', 'cuffed beanie', 'knit hat'].some(k => t.includes(k))) return 'beanies'
  if (['bucket hat'].some(k => t.includes(k))) return 'bucket-hats'
  if (['snapback'].some(k => t.includes(k))) return 'snapbacks'
  if (['dad hat', 'dad cap'].some(k => t.includes(k))) return 'dad-hats'
  if (['5-panel', '5 panel', 'five panel'].some(k => t.includes(k))) return '5-panel-caps'
  if (['hat', 'cap'].some(k => t.includes(k))) return 'caps'

  // Accessories (remaining)
  if (['tote', 'bag', 'backpack', 'duffle'].some(k => t.includes(k))) return 'bags'

  // --- Broader parent categories (fallbacks) ---
  if (['kids', 'children', 'baby'].some(k => t.includes(k))) return 'kids'
  if (['drinkware'].some(k => t.includes(k))) return 'drinkware'
  if (['shirt', 'clothing', 'apparel', 'wear'].some(k => t.includes(k))) return 't-shirts'
  if (['accessory', 'accessories', 'watch'].some(k => t.includes(k))) return 'accessories'
  if (['shoe', 'sneaker', 'trainer'].some(k => t.includes(k))) return 'sneakers'

  return 'accessories' // Default fallback
}

/**
 * Infer category_id from product title. Only used for NEW products.
 * Existing products keep their manually-set or previously-inferred category.
 */
export async function inferCategoryId(
  title: string,
  supabase: SupabaseClient,
): Promise<{ category_id: string | null }> {
  const slug = inferCategorySlug(title)
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .limit(1)
  return { category_id: data?.[0]?.id || null }
}
