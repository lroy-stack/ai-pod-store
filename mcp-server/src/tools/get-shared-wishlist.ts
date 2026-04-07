import { z } from 'zod';
import { getAnonClient } from '../lib/supabase.js';
import { extractFirstImage, userContent } from '../lib/product-helpers.js';

export const getSharedWishlistSchema = z.object({
  token: z.string().min(1).max(100).describe('The share token for the wishlist'),
});

export type GetSharedWishlistInput = z.infer<typeof getSharedWishlistSchema>;

export interface GetSharedWishlistResult {
  success: boolean;
  error?: string;
  wishlist?: {
    id: string;
    name: string;
    owner_name: string | null;
    items: Array<{
      id: string;
      product_id: string;
      title: string;
      price: number;
      currency: string;
      image: string;
      variant_id: string | null;
      variant_label: string | null;
    }>;
  };
}

export async function getSharedWishlist(
  input: GetSharedWishlistInput
): Promise<GetSharedWishlistResult> {
  try {
    const supabase = getAnonClient();
    const { token } = input;

    // Find wishlist by share token (must be public)
    const { data: wishlist, error: wishlistError } = await supabase
      .from('wishlists')
      .select('id, name, user_id, share_token')
      .eq('share_token', token)
      .eq('is_public', true)
      .single();

    if (wishlistError || !wishlist) {
      return { success: false, error: 'Shared wishlist not found or link has expired' };
    }

    // Fetch owner name
    const { data: owner } = await supabase
      .from('users')
      .select('name')
      .eq('id', wishlist.user_id)
      .single();

    // Fetch wishlist items with product + variant data in single JOINed query
    const { data: items, error: itemsError } = await supabase
      .from('wishlist_items')
      .select(`
        id, product_id, variant_id,
        products!inner(id, title, base_price_cents, currency, images, status),
        product_variants(size, color)
      `)
      .eq('wishlist_id', wishlist.id)
      .eq('products.status', 'active')
      .order('created_at', { ascending: false });

    if (itemsError) {
      console.error('[get_shared_wishlist] Items error:', itemsError);
      return { success: false, error: 'Failed to fetch wishlist items' };
    }

    const enrichedItems = (items || []).map((item: any) => {
      const product = item.products;
      const variant = item.product_variants;
      const variantParts = [variant?.size, variant?.color].filter(Boolean);
      return {
        id: item.id,
        product_id: item.product_id,
        title: product?.title || '',
        price: (product?.base_price_cents || 0) / 100,
        currency: (product?.currency || 'EUR').toUpperCase(),
        image: extractFirstImage(product?.images),
        variant_id: item.variant_id || null,
        variant_label: variantParts.length > 0 ? variantParts.join(' / ') : null,
      };
    });

    return {
      success: true,
      wishlist: {
        id: wishlist.id,
        name: wishlist.name || 'Wishlist',
        owner_name: owner?.name ? userContent(owner.name) : null,
        items: enrichedItems,
      },
    };
  } catch (err) {
    console.error('[get_shared_wishlist] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
