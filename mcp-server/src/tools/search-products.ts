import { z } from 'zod';
import { getAnonClient } from '../lib/supabase.js';
import { extractFirstImage, userContent } from '../lib/product-helpers.js';

/**
 * MCP Tool: search_products
 *
 * Search for products using full-text search + optional category filter.
 * Supports ILIKE fallback when wfts returns no results.
 *
 * This is a PUBLIC tool (no authentication required).
 */

export const searchProductsSchema = z.object({
  query: z.string().min(1).max(200).describe(
    'Search query (English). Searches title and description using full-text search.'
  ),
  category: z.string().max(50).optional().describe(
    'Category slug to filter by (e.g. "t-shirts", "pullover-hoodies", "beanies"). Use list_categories to discover available slugs.'
  ),
  limit: z.number().int().min(1).max(50).optional().default(10).describe(
    'Maximum number of products to return (default: 10, max: 50)'
  ),
});

export type SearchProductsInput = z.infer<typeof searchProductsSchema>;

export interface SearchProductsResult {
  success: boolean;
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
  /** When 0 results, suggests available categories for the LLM to try */
  suggestions?: string[];
}

/**
 * Sanitize for PostgreSQL full-text search (wfts) — strip special chars
 */
function sanitizeForFts(query: string): string {
  return query.replace(/[^\w\s'-]/g, '').trim();
}

/**
 * Sanitize for ILIKE fallback
 */
function sanitizeForLike(query: string): string {
  const escaped = query.replace(/[%_\\]/g, '\\$&');
  return `%${escaped}%`;
}

export async function searchProducts(input: SearchProductsInput): Promise<SearchProductsResult> {
  try {
    const supabase = getAnonClient();
    const { query, category, limit } = input;

    // Resolve category slug → category_id(s) if provided
    let categoryIds: string[] | null = null;
    if (category) {
      categoryIds = await resolveCategoryIds(supabase, category);
    }

    // Try full-text search first (wfts), then ILIKE fallback
    let products = await searchWithFts(supabase, query, categoryIds, limit);
    if (products.length === 0) {
      products = await searchWithIlike(supabase, query, categoryIds, limit);
    }

    const mappedProducts = products.map((p: any) => ({
      id: p.id,
      title: p.title,
      price: p.base_price_cents / 100,
      currency: (p.currency || 'EUR').toUpperCase(),
      image: extractFirstImage(p.images),
      rating: Number(p.avg_rating) || 0,
      category: p.categories?.slug || p.category || '',
      description: userContent(p.description),
    }));

    // If 0 results, fetch available categories as suggestions
    if (mappedProducts.length === 0) {
      const suggestions = await getAvailableCategories(supabase);
      return {
        success: true,
        total: 0,
        products: [],
        suggestions,
      };
    }

    return {
      success: true,
      total: mappedProducts.length,
      products: mappedProducts,
    };
  } catch (error) {
    console.error('[search_products] Unexpected error:', error);
    return { success: false, total: 0, products: [] };
  }
}

/**
 * Full-text search using PostgreSQL wfts (web full-text search)
 */
async function searchWithFts(
  supabase: any,
  query: string,
  categoryIds: string[] | null,
  limit: number,
): Promise<any[]> {
  const sanitized = sanitizeForFts(query);
  if (!sanitized) return [];

  let q = supabase
    .from('products')
    .select('id, title, description, category, category_id, categories(slug), base_price_cents, currency, images, avg_rating, review_count')
    .eq('status', 'active')
    .or(`title.wfts.${sanitized},description.wfts.${sanitized}`)
    .order('avg_rating', { ascending: false })
    .limit(limit);

  if (categoryIds) {
    q = q.in('category_id', categoryIds);
  }

  const { data, error } = await q;
  if (error) {
    console.error('[search_products] wfts error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * ILIKE fallback when full-text search returns no results
 */
async function searchWithIlike(
  supabase: any,
  query: string,
  categoryIds: string[] | null,
  limit: number,
): Promise<any[]> {
  const sanitized = sanitizeForLike(query);

  let q = supabase
    .from('products')
    .select('id, title, description, category, category_id, categories(slug), base_price_cents, currency, images, avg_rating, review_count')
    .eq('status', 'active')
    .or(`title.ilike.${sanitized},description.ilike.${sanitized},category.ilike.${sanitized}`)
    .order('avg_rating', { ascending: false })
    .limit(limit);

  if (categoryIds) {
    q = q.in('category_id', categoryIds);
  }

  const { data, error } = await q;
  if (error) {
    console.error('[search_products] ILIKE error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Resolve category slug → array of category UUIDs (parent + children)
 */
async function resolveCategoryIds(supabase: any, slug: string): Promise<string[] | null> {
  const { data: cat } = await supabase
    .from('categories')
    .select('id, parent_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!cat) return null;

  // If parent category, include children
  if (!cat.parent_id) {
    const { data: children } = await supabase
      .from('categories')
      .select('id')
      .eq('parent_id', cat.id)
      .eq('is_active', true);

    return [cat.id, ...(children || []).map((c: any) => c.id)];
  }

  return [cat.id];
}

/**
 * Get available category slugs for suggestions when search returns 0
 */
async function getAvailableCategories(supabase: any): Promise<string[]> {
  const { data } = await supabase
    .from('categories')
    .select('slug, name_en')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .limit(10);

  return (data || []).map((c: any) => `${c.name_en} (${c.slug})`);
}
