import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * MCP Tool: get_product_details
 *
 * Get detailed information about a specific product, including all variants.
 * Returns product metadata, images, pricing, and available size/color options.
 *
 * This is a PUBLIC tool (no authentication required).
 */

export const getProductDetailsSchema = z.object({
  product_id: z.string().uuid().describe('The UUID of the product to retrieve'),
});

export type GetProductDetailsInput = z.infer<typeof getProductDetailsSchema>;

export interface ProductVariant {
  id: string;
  title: string;
  size: string | null;
  color: string | null;
  price: number;
  currency: string;
  sku: string | null;
  is_available: boolean;
}

export interface GetProductDetailsResult {
  success: boolean;
  product?: {
    id: string;
    title: string;
    description: string;
    category: string;
    base_price: number;
    currency: string;
    images: Array<{ src: string; alt?: string }>;
    tags: string[];
    rating: number;
    review_count: number;
    variants: {
      sizes: string[];
      colors: string[];
      all: ProductVariant[];
    };
  };
  error?: string;
}

export async function getProductDetails(
  input: GetProductDetailsInput
): Promise<GetProductDetailsResult> {
  try {
    const supabase = getSupabaseClient();
    const { product_id } = input;

    // Fetch product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('status', 'active')
      .single();

    if (productError || !product) {
      return {
        success: false,
        error: productError?.message || 'Product not found',
      };
    }

    // Fetch product variants
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', product_id)
      .eq('is_enabled', true)
      .order('size', { ascending: true })
      .order('color', { ascending: true });

    if (variantsError) {
      console.error('[get_product_details] Error fetching variants:', variantsError);
    }

    // Extract unique sizes and colors from variants
    const allVariants = (variants || []).map((v) => ({
      id: v.id,
      title: v.title,
      size: v.size,
      color: v.color,
      price: v.price_cents / 100,
      currency: (product.currency || 'EUR').toUpperCase(),
      sku: v.sku,
      is_available: v.is_available ?? true,
    }));

    const sizes = Array.from(
      new Set(allVariants.map((v) => v.size).filter((s): s is string => !!s))
    ).sort();

    const colors = Array.from(
      new Set(allVariants.map((v) => v.color).filter((c): c is string => !!c))
    ).sort();

    // Parse images JSONB
    let images: Array<{ src: string; alt?: string }> = [];
    if (product.images) {
      if (Array.isArray(product.images)) {
        images = product.images.map((img: any) => ({
          src: img.src || img.url || '',
          alt: img.alt || product.title,
        }));
      }
    }

    return {
      success: true,
      product: {
        id: product.id,
        title: product.title,
        description: product.description || '',
        category: product.category || '',
        base_price: product.base_price_cents / 100,
        currency: (product.currency || 'EUR').toUpperCase(),
        images,
        tags: Array.isArray(product.tags) ? product.tags : [],
        rating: Number(product.avg_rating) || 0,
        review_count: product.review_count || 0,
        variants: {
          sizes,
          colors,
          all: allVariants,
        },
      },
    };
  } catch (error) {
    console.error('[get_product_details] Unexpected error:', error);
    return {
      success: false,
      error: 'Internal server error',
    };
  }
}
