import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * MCP Tool: update_cart
 *
 * Add, update, or remove items from the authenticated user's shopping cart.
 *
 * - quantity > 0: Add or update item
 * - quantity = 0: Remove item
 *
 * This is a PROTECTED tool — authentication required.
 * Returns 401 error if no valid Bearer token provided.
 */

export const updateCartSchema = z.object({
  product_id: z.string().uuid().describe('The UUID of the product to add/update/remove'),
  variant_id: z.string().uuid().optional().describe('Variant ID. Required when adding items (quantity > 0) for products with multiple variants. Auto-selected if product has only one variant.'),
  quantity: z.number().int().min(0).max(100).describe('Quantity to set (0 to remove item)'),
});

export type UpdateCartInput = z.infer<typeof updateCartSchema>;

export interface UpdateCartResult {
  success: boolean;
  error?: string;
  message?: string;
  needsVariantSelection?: boolean;
  available_variants?: Array<{ id: string; size?: string; color?: string }>;
  cart_item?: {
    id: string;
    product_id: string;
    variant_id: string;
    quantity: number;
  };
}

export async function updateCart(
  input: UpdateCartInput,
  authInfo?: AuthInfo
): Promise<UpdateCartResult> {
  // Check authentication
  if (!authInfo || !authInfo.extra?.userId) {
    return {
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    };
  }

  const userId = authInfo.extra.userId as string;
  const { product_id, variant_id, quantity } = input;

  try {
    const supabase = getSupabaseClient();

    // Verify product exists
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('id, status')
      .eq('id', product_id)
      .single();

    if (productError || !productData) {
      return {
        success: false,
        error: 'Product not found',
      };
    }

    if (productData.status !== 'active') {
      return {
        success: false,
        error: 'Product is not available',
      };
    }

    // If variant_id provided, verify it exists and belongs to this product
    if (variant_id) {
      const { data: variantData, error: variantError } = await supabase
        .from('product_variants')
        .select('id, product_id, is_enabled, is_available')
        .eq('id', variant_id)
        .single();

      if (variantError || !variantData) {
        return {
          success: false,
          error: 'Variant not found',
        };
      }

      if (variantData.product_id !== product_id) {
        return {
          success: false,
          error: 'Variant does not belong to this product',
        };
      }

      if (!variantData.is_enabled || !variantData.is_available) {
        return {
          success: false,
          error: 'Variant is not available',
        };
      }
    }

    // For adds (quantity > 0): variant_id is required — autoselect or reject
    let resolvedVariantId = variant_id;
    if (quantity > 0 && !resolvedVariantId) {
      const { data: availableVariants } = await supabase
        .from('product_variants')
        .select('id, size, color')
        .eq('product_id', product_id)
        .eq('is_enabled', true)
        .eq('is_available', true);

      if (availableVariants && availableVariants.length === 1) {
        resolvedVariantId = availableVariants[0].id;
      } else if (availableVariants && availableVariants.length > 1) {
        return {
          success: false,
          error: 'Variant selection required. This product has multiple variants.',
          needsVariantSelection: true,
          available_variants: availableVariants,
        };
      } else {
        return {
          success: false,
          error: 'No available variants for this product',
        };
      }
    }

    // Build query to find existing cart item
    let query = supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('product_id', product_id);

    if (resolvedVariantId) {
      query = query.eq('variant_id', resolvedVariantId);
    }

    const { data: existingItem, error: queryError } = await query.maybeSingle();

    if (queryError) {
      console.error('[update_cart] Query error:', queryError);
      return {
        success: false,
        error: 'Failed to query cart',
      };
    }

    // Case 1: Remove item (quantity = 0)
    if (quantity === 0) {
      if (!existingItem) {
        return {
          success: true,
          message: 'Item was not in cart (already removed)',
        };
      }

      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', existingItem.id);

      if (deleteError) {
        console.error('[update_cart] Delete error:', deleteError);
        return {
          success: false,
          error: 'Failed to remove item from cart',
        };
      }

      return {
        success: true,
        message: 'Item removed from cart',
      };
    }

    // Case 2: Update existing item quantity
    if (existingItem) {
      const { data: updatedItem, error: updateError } = await supabase
        .from('cart_items')
        .update({
          quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingItem.id)
        .select('id, product_id, variant_id, quantity')
        .single();

      if (updateError) {
        console.error('[update_cart] Update error:', updateError);
        return {
          success: false,
          error: 'Failed to update cart item',
        };
      }

      return {
        success: true,
        message: 'Cart item quantity updated',
        cart_item: {
          id: updatedItem.id,
          product_id: updatedItem.product_id,
          variant_id: updatedItem.variant_id,
          quantity: updatedItem.quantity,
        },
      };
    }

    // Case 3: Add new item to cart (resolvedVariantId is guaranteed non-null for quantity > 0)

    // Check cart item count limit before adding new item
    const { count: cartItemCount } = await supabase
      .from('cart_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if ((cartItemCount ?? 0) >= 50) {
      return {
        success: false,
        error: 'Cart limit reached. Maximum 50 different items allowed.',
      };
    }

    const { data: newItem, error: insertError } = await supabase
      .from('cart_items')
      .insert({
        user_id: userId,
        product_id,
        variant_id: resolvedVariantId,
        quantity,
      })
      .select('id, product_id, variant_id, quantity')
      .single();

    if (insertError) {
      console.error('[update_cart] Insert error:', insertError);
      return {
        success: false,
        error: 'Failed to add item to cart',
      };
    }

    return {
      success: true,
      message: 'Item added to cart',
      cart_item: {
        id: newItem.id,
        product_id: newItem.product_id,
        variant_id: newItem.variant_id,
        quantity: newItem.quantity,
      },
    };
  } catch (err) {
    console.error('[update_cart] Unexpected error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
