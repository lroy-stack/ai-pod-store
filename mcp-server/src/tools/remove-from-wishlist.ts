import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * MCP Tool: remove_from_wishlist
 *
 * Remove a product from the authenticated user's default wishlist.
 *
 * This is a PROTECTED tool — authentication required.
 * Returns 401 error if no valid Bearer token provided.
 */

export const removeFromWishlistSchema = z.object({
  product_id: z.string().uuid().describe('The UUID of the product to remove from the wishlist'),
  variant_id: z
    .string()
    .uuid()
    .optional()
    .describe('Optional: The UUID of a specific product variant to remove'),
});

export type RemoveFromWishlistInput = z.infer<typeof removeFromWishlistSchema>;

export interface RemoveFromWishlistResult {
  success: boolean;
  error?: string;
  removed?: boolean;
}

export async function removeFromWishlist(
  input: RemoveFromWishlistInput,
  authInfo?: AuthInfo
): Promise<RemoveFromWishlistResult> {
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

    // Get user's default wishlist
    const { data: wishlist, error: wishlistError } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (wishlistError) {
      if (wishlistError.code === 'PGRST116') {
        // No wishlist exists — nothing to remove
        return {
          success: true,
          removed: false,
        };
      }

      console.error('[remove_from_wishlist] Wishlist fetch error:', wishlistError);
      return {
        success: false,
        error: 'Failed to fetch wishlist',
      };
    }

    // Build the delete query
    let query = supabase
      .from('wishlist_items')
      .delete()
      .eq('wishlist_id', wishlist.id)
      .eq('product_id', product_id);

    // Add variant_id filter if provided
    if (variant_id) {
      query = query.eq('variant_id', variant_id);
    } else {
      // If no variant_id, remove all items with this product (regardless of variant)
      query = query.is('variant_id', null);
    }

    const { error: deleteError, count } = await query;

    if (deleteError) {
      console.error('[remove_from_wishlist] Delete error:', deleteError);
      return {
        success: false,
        error: 'Failed to remove product from wishlist',
      };
    }

    return {
      success: true,
      removed: (count ?? 0) > 0,
    };
  } catch (err) {
    console.error('[remove_from_wishlist] Unexpected error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
