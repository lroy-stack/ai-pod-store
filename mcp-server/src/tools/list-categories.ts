import { z } from 'zod';
import { getAnonClient } from '../lib/supabase.js';

/**
 * MCP Tool: list_categories
 *
 * List all product categories with product counts and localized names.
 * Uses the categories table (not legacy products.category string).
 * Essential for product discovery — call this FIRST when user asks
 * for products by type in any language.
 *
 * This is a PUBLIC tool (no authentication required).
 */

export const listCategoriesSchema = z.object({
  locale: z.enum(['en', 'es', 'de']).optional().default('en').describe(
    'Language for category names (en, es, de). Default: en.'
  ),
});

export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;

export interface ListCategoriesResult {
  success: boolean;
  categories: Array<{
    slug: string;
    name: string;
    product_count: number;
    parent_slug: string | null;
  }>;
}

export async function listCategories(input: ListCategoriesInput): Promise<ListCategoriesResult> {
  try {
    const supabase = getAnonClient();
    const { locale } = input;
    const nameField = `name_${locale}` as const;

    // Fetch categories with product counts via LEFT JOIN
    const { data: categories, error } = await supabase
      .from('categories')
      .select(`
        id, slug, name_en, name_es, name_de, parent_id, display_order,
        products!inner(id)
      `)
      .eq('is_active', true)
      .eq('products.status', 'active')
      .order('slug', { ascending: true });

    if (error) {
      // Fallback: if JOIN fails (e.g. no products FK), use legacy approach
      console.error('[list_categories] Join query error, falling back:', error.message);
      return fallbackListCategories(supabase, locale);
    }

    // Group by category and count products
    const catMap = new Map<string, { slug: string; name: string; count: number; parentId: string | null }>();

    for (const cat of (categories || [])) {
      const existing = catMap.get(cat.id);
      if (existing) {
        existing.count++;
      } else {
        catMap.set(cat.id, {
          slug: cat.slug,
          name: (cat as any)[nameField] || cat.name_en,
          count: 1,
          parentId: cat.parent_id,
        });
      }
    }

    // Build parent slug map
    const idToSlug = new Map<string, string>();
    for (const [id, cat] of catMap) {
      idToSlug.set(id, cat.slug);
    }

    const result = Array.from(catMap.values())
      .map(c => ({
        slug: c.slug,
        name: c.name,
        product_count: c.count,
        parent_slug: c.parentId ? (idToSlug.get(c.parentId) || null) : null,
      }))
      .sort((a, b) => b.product_count - a.product_count);

    return { success: true, categories: result };
  } catch (error) {
    console.error('[list_categories] Unexpected error:', error);
    return { success: false, categories: [] };
  }
}

/**
 * Fallback: aggregate from products.category string (legacy)
 */
async function fallbackListCategories(
  supabase: any,
  _locale: string,
): Promise<ListCategoriesResult> {
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .eq('status', 'active')
    .not('category', 'is', null)
    .not('category', 'eq', '');

  if (error) return { success: false, categories: [] };

  const catMap = new Map<string, number>();
  for (const p of (data || [])) {
    const cat = p.category?.trim();
    if (!cat) continue;
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  }

  const categories = Array.from(catMap.entries())
    .map(([name, count]) => ({
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      name,
      product_count: count,
      parent_slug: null,
    }))
    .sort((a, b) => b.product_count - a.product_count);

  return { success: true, categories };
}
