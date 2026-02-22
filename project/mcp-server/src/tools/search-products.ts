import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * MCP Tool: search_products
 *
 * Search for products in the store catalog.
 * Returns a list of products matching the search query.
 *
 * This is a PUBLIC tool (no authentication required).
 */

export const searchProductsSchema = z.object({
  query: z.string().min(1).max(200).describe('Search query to find products (searches title, description, category)'),
  limit: z.number().int().min(1).max(50).optional().default(10).describe('Maximum number of products to return (default: 10, max: 50)'),
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
}

/**
 * Sanitize search query for PostgreSQL ILIKE to prevent SQL injection
 */
function sanitizeForLike(query: string): string {
  // Escape special characters: % _ \ (PostgreSQL LIKE wildcards)
  const escaped = query.replace(/[%_\\]/g, '\\$&');
  // Wrap with wildcards for partial matching
  return `%${escaped}%`;
}

export async function searchProducts(input: SearchProductsInput): Promise<SearchProductsResult> {
  try {
    const supabase = getSupabaseClient();
    const { query, limit } = input;

    // Sanitize the search query to prevent SQL injection
    const sanitizedQuery = sanitizeForLike(query);

    // Search products using PostgreSQL ILIKE (case-insensitive)
    // Search in title, description, and category fields
    const { data: products, error } = await supabase
      .from('products')
      .select('id, title, description, category, base_price_cents, currency, images, avg_rating, review_count')
      .eq('status', 'active')
      .or(`title.ilike.${sanitizedQuery},description.ilike.${sanitizedQuery},category.ilike.${sanitizedQuery}`)
      .order('avg_rating', { ascending: false }) // Sort by rating (best first)
      .limit(limit);

    if (error) {
      console.error('[search_products] Supabase error:', error);
      return {
        success: false,
        total: 0,
        products: [],
      };
    }

    // Map database schema to MCP response format
    const mappedProducts = (products || []).map((p) => ({
      id: p.id,
      title: p.title,
      price: p.base_price_cents / 100, // Convert cents to decimal
      currency: (p.currency || 'EUR').toUpperCase(),
      image: Array.isArray(p.images) && p.images.length > 0
        ? (p.images[0].src || p.images[0].url || '')
        : '',
      rating: Number(p.avg_rating) || 0,
      category: p.category || '',
      description: p.description || '',
    }));

    return {
      success: true,
      total: mappedProducts.length,
      products: mappedProducts,
    };
  } catch (error) {
    console.error('[search_products] Unexpected error:', error);
    return {
      success: false,
      total: 0,
      products: [],
    };
  }
}
