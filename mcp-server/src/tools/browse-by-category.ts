import { z } from 'zod';
import { getAnonClient } from '../lib/supabase.js';
import { extractFirstImage, userContent } from '../lib/product-helpers.js';

/**
 * MCP Tool: browse_by_category
 *
 * Browse products by category slug. Use list_categories first to discover
 * available slugs. This is the primary way to find products when the user
 * asks by type (e.g. "gorras", "hoodies", "camisetas") rather than by name.
 *
 * This is a PUBLIC tool (no authentication required).
 */

export const browseByCategorySchema = z.object({
  category: z.string().min(1).max(50).describe(
    'Category slug from list_categories (e.g. "t-shirts", "pullover-hoodies", "beanies", "snapbacks")'
  ),
  limit: z.number().int().min(1).max(50).optional().default(20).describe(
    'Maximum products to return (default: 20)'
  ),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating']).optional().default('rating').describe(
    'Sort order: newest, price_asc, price_desc, rating (default: rating)'
  ),
});

export type BrowseByCategoryInput = z.infer<typeof browseByCategorySchema>;

export interface BrowseByCategoryResult {
  success: boolean;
  category_name?: string;
  total: number;
  products: Array<{
    id: string;
    title: string;
    price: number;
    currency: string;
    image: string;
    rating: number;
    category: string;
    description: string;
  }>;
  error?: string;
}

export async function browseByCategory(input: BrowseByCategoryInput): Promise<BrowseByCategoryResult> {
  try {
    const supabase = getAnonClient();
    const { category, limit, sort } = input;

    // Resolve category slug → ID(s) including children
    const { data: cat } = await supabase
      .from('categories')
      .select('id, name_en, parent_id')
      .eq('slug', category)
      .eq('is_active', true)
      .single();

    let categoryIds: string[];
    let categoryName: string;

    if (cat) {
      categoryName = cat.name_en;
      categoryIds = [cat.id];

      // Include children if parent category
      if (!cat.parent_id) {
        const { data: children } = await supabase
          .from('categories')
          .select('id')
          .eq('parent_id', cat.id)
          .eq('is_active', true);
        if (children) {
          categoryIds.push(...children.map((c: any) => c.id));
        }
      }
    } else {
      // Fallback: try legacy products.category string match
      categoryName = category;
      categoryIds = [];
    }

    // Build product query
    let query = supabase
      .from('products')
      .select('id, title, description, category, category_id, categories(slug), base_price_cents, currency, images, avg_rating, review_count')
      .eq('status', 'active');

    if (categoryIds.length > 0) {
      query = query.in('category_id', categoryIds);
    } else {
      // Fallback: string match on legacy category field (escape ILIKE wildcards)
      query = query.ilike('category', `%${category.replace(/[%_\\]/g, '\\$&')}%`);
    }

    // Apply sort
    switch (sort) {
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'price_asc':
        query = query.order('base_price_cents', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('base_price_cents', { ascending: false });
        break;
      case 'rating':
      default:
        query = query.order('avg_rating', { ascending: false });
        break;
    }

    query = query.limit(limit);

    const { data: products, error } = await query;

    if (error) {
      console.error('[browse_by_category] Supabase error:', error);
      return { success: false, total: 0, products: [], error: 'Database error' };
    }

    const mapped = (products || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      price: p.base_price_cents / 100,
      currency: (p.currency || 'EUR').toUpperCase(),
      image: extractFirstImage(p.images),
      rating: Number(p.avg_rating) || 0,
      category: p.categories?.slug || p.category || '',
      description: userContent(p.description),
    }));

    return {
      success: true,
      category_name: categoryName,
      total: mapped.length,
      products: mapped,
    };
  } catch (error) {
    console.error('[browse_by_category] Unexpected error:', error);
    return { success: false, total: 0, products: [], error: 'Internal error' };
  }
}
