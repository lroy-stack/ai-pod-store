import { z } from 'zod';
import { getAnonClient } from '../lib/supabase.js';
import { extractFirstImage } from '../lib/product-helpers.js';

export const getTrendingProductsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(12).describe('Number of trending products to return (1-50, default 12)'),
});

export type GetTrendingProductsInput = z.infer<typeof getTrendingProductsSchema>;

export interface GetTrendingProductsResult {
  success: boolean;
  error?: string;
  total: number;
  products: Array<{
    id: string;
    title: string;
    price: number;
    currency: string;
    image: string;
    rating: number;
    review_count: number;
    category: string;
  }>;
}

export async function getTrendingProducts(
  input: GetTrendingProductsInput
): Promise<GetTrendingProductsResult> {
  try {
    const supabase = getAnonClient();
    const { limit } = input;

    // Try trending_products view first (7-day weighted score)
    let products: any[] | null = null;

    const viewResult = await supabase
      .from('trending_products')
      .select('id, title, base_price_cents, currency, images, avg_rating, review_count, category')
      .limit(limit);

    if (!viewResult.error && viewResult.data && viewResult.data.length > 0) {
      products = viewResult.data;
    } else {
      // Fallback: products ordered by review_count
      const fallbackResult = await supabase
        .from('products')
        .select('id, title, base_price_cents, currency, images, avg_rating, review_count, category')
        .eq('status', 'active')
        .order('review_count', { ascending: false })
        .order('avg_rating', { ascending: false })
        .limit(limit);

      if (fallbackResult.error) {
        console.error('[get_trending_products] Database error:', fallbackResult.error);
        return { success: false, error: 'Failed to fetch trending products', total: 0, products: [] };
      }
      products = fallbackResult.data;
    }

    const mapped = (products || []).map((p) => ({
      id: p.id,
      title: p.title,
      price: (p.base_price_cents || 0) / 100,
      currency: (p.currency || 'EUR').toUpperCase(),
      image: extractFirstImage(p.images),
      rating: Number(p.avg_rating) || 0,
      review_count: p.review_count || 0,
      category: p.category || '',
    }));

    return { success: true, total: mapped.length, products: mapped };
  } catch (err) {
    console.error('[get_trending_products] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred', total: 0, products: [] };
  }
}
