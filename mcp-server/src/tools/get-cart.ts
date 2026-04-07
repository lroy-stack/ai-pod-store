import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * MCP Tool: get_cart
 *
 * Get the authenticated user's current shopping cart contents.
 *
 * This is a PROTECTED tool — authentication required.
 * Returns 401 error if no valid Bearer token provided.
 */

export const getCartSchema = z.object({
  // No parameters needed — cart is fetched for the authenticated user
});

export type GetCartInput = z.infer<typeof getCartSchema>;

export interface CartItem {
  id: string;
  product_id: string;
  product_title: string;
  variant_id?: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url?: string;
  created_at: string;
}

export interface GetCartResult {
  success: boolean;
  error?: string;
  items?: CartItem[];
  cart_total?: number;
  currency?: string;
}

export async function getCart(
  _input: GetCartInput,
  authInfo?: AuthInfo
): Promise<GetCartResult> {
  // Check authentication
  if (!authInfo || !authInfo.extra?.userId) {
    return {
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    };
  }

  const userId = authInfo.extra.userId as string;

  try {
    const supabase = getSupabaseClient();

    // Fetch cart items with product and variant details
    const { data, error } = await supabase
      .from('cart_items')
      .select(
        `
        id,
        product_id,
        variant_id,
        quantity,
        created_at,
        products:product_id (
          title,
          base_price_cents,
          currency,
          images
        ),
        product_variants:variant_id (
          title,
          price_cents
        )
      `
      )
      .eq('user_id', userId);

    if (error) {
      console.error('[get_cart] Database error:', error);
      return {
        success: false,
        error: 'Failed to fetch cart items',
      };
    }

    if (!data || data.length === 0) {
      // Empty cart is valid
      return {
        success: true,
        items: [],
        cart_total: 0,
        currency: 'EUR',
      };
    }

    // Transform data
    const items: CartItem[] = data.map((item: any) => {
      const product = item.products;
      const variant = item.product_variants;

      // Use variant price if available, otherwise use product base price
      const unitPriceCents = variant?.price_cents || product?.base_price_cents || 0;
      const unitPrice = unitPriceCents / 100;
      const totalPrice = unitPrice * item.quantity;

      // Get first image URL if available (images is JSONB array of {src, alt} objects)
      const images = product?.images;
      const firstImage = Array.isArray(images) && images.length > 0 ? images[0] : undefined;
      const imageUrl = firstImage?.src || firstImage?.url || (typeof firstImage === 'string' ? firstImage : undefined);

      return {
        id: item.id,
        product_id: item.product_id,
        product_title: product?.title || 'Unknown Product',
        ...(item.variant_id && { variant_id: item.variant_id }),
        ...(variant?.title && { variant_name: variant.title }),
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        ...(imageUrl && { image_url: imageUrl }),
        created_at: item.created_at,
      };
    });

    // Calculate cart total
    const cartTotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const firstProduct = data[0]?.products as unknown as Record<string, unknown> | undefined;
    const currency = (firstProduct?.currency as string)?.toUpperCase() || 'EUR';

    return {
      success: true,
      items,
      cart_total: cartTotal,
      currency,
    };
  } catch (err) {
    console.error('[get_cart] Unexpected error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
