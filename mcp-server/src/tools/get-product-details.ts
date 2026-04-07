import { z } from 'zod';
import { getAnonClient } from '../lib/supabase.js';
import { userContent } from '../lib/product-helpers.js';

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
      colorImages: Record<string, string>;
      all: ProductVariant[];
    };
    product_details: {
      material?: string;
      print_technique?: string;
      manufacturing_country?: string;
      care_instructions?: string;
      safety_information?: string;
      brand?: string;
    };
  };
  error?: string;
}

export async function getProductDetails(
  input: GetProductDetailsInput
): Promise<GetProductDetailsResult> {
  try {
    const supabase = getAnonClient();
    const { product_id } = input;

    // Fetch product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, title, description, base_price_cents, currency, images, category, tags, status, avg_rating, review_count, product_details, created_at, updated_at')
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
    ).sort((a, b) => {
      // White variants first, then alphabetical
      const aWhite = /^white/i.test(a) ? 0 : 1;
      const bWhite = /^white/i.test(b) ? 0 : 1;
      return aWhite - bWhite || a.localeCompare(b);
    });

    // Build colorImages map: first variant image_url per color
    const colorImages: Record<string, string> = {};
    for (const v of (variants || [])) {
      if (v.color && v.image_url && !colorImages[v.color]) {
        colorImages[v.color] = v.image_url;
      }
    }

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

    // Extract product_details JSONB (material, GPSR, care, etc.)
    const pd = (product.product_details && typeof product.product_details === 'object')
      ? product.product_details as Record<string, unknown>
      : {};

    return {
      success: true,
      product: {
        id: product.id,
        title: product.title,
        description: userContent(product.description),
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
          colorImages,
          all: allVariants,
        },
        product_details: {
          material: pd.material ? String(pd.material) : undefined,
          print_technique: pd.print_technique ? String(pd.print_technique) : undefined,
          manufacturing_country: pd.manufacturing_country ? String(pd.manufacturing_country) : undefined,
          care_instructions: pd.care_instructions ? String(pd.care_instructions) : undefined,
          safety_information: pd.safety_information ? String(pd.safety_information) : undefined,
          brand: pd.brand ? String(pd.brand) : undefined,
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
