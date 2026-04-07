import { z } from 'zod';
import { getAnonClient } from '../lib/supabase.js';
import { extractFirstImage } from '../lib/product-helpers.js';

export const getCrossSellSchema = z.object({
  product_id: z.string().uuid().describe('The UUID of the product to get recommendations for'),
});

export type GetCrossSellInput = z.infer<typeof getCrossSellSchema>;

export interface GetCrossSellResult {
  success: boolean;
  error?: string;
  recommendations: Array<{
    id: string;
    title: string;
    price: number;
    currency: string;
    image: string;
    rating: number;
    category: string;
  }>;
}

export async function getCrossSell(
  input: GetCrossSellInput
): Promise<GetCrossSellResult> {
  try {
    const supabase = getAnonClient();
    const { product_id } = input;

    // Try association_rules first (co-purchase recommendations)
    const { data: rules } = await supabase
      .from('association_rules')
      .select('consequents, confidence, lift')
      .contains('antecedents', [product_id])
      .order('lift', { ascending: false })
      .limit(4);

    let recommendedIds: string[] = [];
    let products: any[] = [];

    if (rules && rules.length > 0) {
      for (const rule of rules) {
        if (rule.consequents && Array.isArray(rule.consequents)) {
          recommendedIds.push(...rule.consequents);
        }
      }
      recommendedIds = [...new Set(recommendedIds)]
        .filter((id) => id !== product_id)
        .slice(0, 6);

      if (recommendedIds.length > 0) {
        const { data, error } = await supabase
          .from('products')
          .select('id, title, base_price_cents, currency, images, avg_rating, category')
          .in('id', recommendedIds)
          .eq('status', 'active');

        if (!error && data) {
          products = data;
        }
      }
    }

    // Fallback: same category products
    if (products.length === 0) {
      const { data: sourceProduct } = await supabase
        .from('products')
        .select('category_id, category')
        .eq('id', product_id)
        .single();

      const categoryFilter = sourceProduct?.category_id || sourceProduct?.category;
      const categoryField = sourceProduct?.category_id ? 'category_id' : 'category';

      if (categoryFilter) {
        const { data, error } = await supabase
          .from('products')
          .select('id, title, base_price_cents, currency, images, avg_rating, category')
          .eq('status', 'active')
          .eq(categoryField, categoryFilter)
          .neq('id', product_id)
          .order('avg_rating', { ascending: false })
          .limit(6);

        if (!error && data) {
          products = data;
        }
      }
    }

    const mapped = products.map((p) => ({
      id: p.id,
      title: p.title,
      price: (p.base_price_cents || 0) / 100,
      currency: (p.currency || 'EUR').toUpperCase(),
      image: extractFirstImage(p.images),
      rating: Number(p.avg_rating) || 0,
      category: p.category || '',
    }));

    return { success: true, recommendations: mapped };
  } catch (err) {
    console.error('[get_cross_sell] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred', recommendations: [] };
  }
}
