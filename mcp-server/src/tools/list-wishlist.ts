import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { extractFirstImage } from '../lib/product-helpers.js';

/**
 * MCP Tool: list_wishlist
 *
 * List all items in the authenticated user's default wishlist.
 *
 * This is a PROTECTED tool — authentication required.
 * Returns 401 error if no valid Bearer token provided.
 */

export const listWishlistSchema = z.object({
  // No parameters needed — uses auth token
});

export type ListWishlistInput = z.infer<typeof listWishlistSchema>;

export interface ListWishlistResult {
  success: boolean;
  error?: string;
  items?: Array<{
    id: string;
    product_id: string;
    product_name: string;
    product_price: number;
    product_image: string | null;
    variant_id: string | null;
    variant_name: string | null;
    added_at: string;
  }>;
}

export async function listWishlist(
  _input: ListWishlistInput,
  authInfo?: AuthInfo
): Promise<ListWishlistResult> {
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

    // Get or create user's default wishlist
    let { data: wishlist, error: wishlistError } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (wishlistError && wishlistError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('[list_wishlist] Wishlist fetch error:', wishlistError);
      return {
        success: false,
        error: 'Failed to fetch wishlist',
      };
    }

    // If no wishlist exists, create one
    if (!wishlist) {
      const { data: newWishlist, error: createError } = await supabase
        .from('wishlists')
        .insert({
          user_id: userId,
          name: 'My Wishlist',
          is_public: false,
        })
        .select('id')
        .single();

      if (createError) {
        console.error('[list_wishlist] Wishlist creation error:', createError);
        return {
          success: false,
          error: 'Failed to create wishlist',
        };
      }

      wishlist = newWishlist;
    }

    // Fetch wishlist items with product details
    const { data: items, error: itemsError } = await supabase
      .from('wishlist_items')
      .select(
        `
        id,
        product_id,
        variant_id,
        added_at,
        products (
          id,
          title,
          base_price_cents,
          currency,
          images
        ),
        product_variants (
          id,
          title
        )
      `
      )
      .eq('wishlist_id', wishlist.id)
      .order('added_at', { ascending: false });

    if (itemsError) {
      console.error('[list_wishlist] Items fetch error:', itemsError);
      return {
        success: false,
        error: 'Failed to fetch wishlist items',
      };
    }

    // Format the response
    const formattedItems = (items || []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.products?.title || 'Unknown Product',
      product_price: (item.products?.base_price_cents || 0) / 100, // Convert cents to decimal
      product_image: extractFirstImage(item.products?.images) || null,
      variant_id: item.variant_id,
      variant_name: item.product_variants?.title || null,
      added_at: item.added_at,
    }));

    return {
      success: true,
      items: formattedItems,
    };
  } catch (err) {
    console.error('[list_wishlist] Unexpected error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
