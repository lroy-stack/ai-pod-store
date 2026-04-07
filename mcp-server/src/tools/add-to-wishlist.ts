import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * MCP Tool: add_to_wishlist
 *
 * Add a product to the authenticated user's default wishlist.
 *
 * This is a PROTECTED tool — authentication required.
 * Returns 401 error if no valid Bearer token provided.
 */

export const addToWishlistSchema = z.object({
  product_id: z.string().uuid().describe('The UUID of the product to add to the wishlist'),
  variant_id: z
    .string()
    .uuid()
    .optional()
    .describe('Optional: The UUID of a specific product variant to add'),
});

export type AddToWishlistInput = z.infer<typeof addToWishlistSchema>;

export interface AddToWishlistResult {
  success: boolean;
  error?: string;
  item?: {
    id: string;
    product_id: string;
    variant_id: string | null;
    added_at: string;
  };
}

export async function addToWishlist(
  input: AddToWishlistInput,
  authInfo?: AuthInfo
): Promise<AddToWishlistResult> {
  // Check authentication
  if (!authInfo || !authInfo.extra?.userId) {
    return {
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    };
  }

  const userId = authInfo.extra.userId as string;
  const { product_id, variant_id } = input;

  try {
    const supabase = getSupabaseClient();

    // Verify product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return {
        success: false,
        error: 'Product not found',
      };
    }

    // If variant_id provided, verify it exists and belongs to this product
    if (variant_id) {
      const { data: variant, error: variantError } = await supabase
        .from('product_variants')
        .select('id, product_id')
        .eq('id', variant_id)
        .single();

      if (variantError || !variant) {
        return {
          success: false,
          error: 'Product variant not found',
        };
      }

      if (variant.product_id !== product_id) {
        return {
          success: false,
          error: 'Variant does not belong to the specified product',
        };
      }
    }

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
      console.error('[add_to_wishlist] Wishlist fetch error:', wishlistError);
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
        console.error('[add_to_wishlist] Wishlist creation error:', createError);
        return {
          success: false,
          error: 'Failed to create wishlist',
        };
      }

      wishlist = newWishlist;
    }

    // Add item to wishlist (UNIQUE constraint prevents duplicates)
    const { data: item, error: insertError } = await supabase
      .from('wishlist_items')
      .insert({
        wishlist_id: wishlist.id,
        product_id: product_id,
        variant_id: variant_id || null,
      })
      .select('id, product_id, variant_id, added_at')
      .single();

    if (insertError) {
      // Check if duplicate (UNIQUE constraint violation)
      if (insertError.code === '23505') {
        return {
          success: false,
          error: 'This product is already in your wishlist',
        };
      }

      console.error('[add_to_wishlist] Insert error:', insertError);
      return {
        success: false,
        error: 'Failed to add product to wishlist',
      };
    }

    return {
      success: true,
      item: {
        id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        added_at: item.added_at,
      },
    };
  } catch (err) {
    console.error('[add_to_wishlist] Unexpected error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
