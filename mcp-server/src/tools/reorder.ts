import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

export const reorderSchema = z.object({
  order_id: z.string().uuid().describe('The UUID of the past order to reorder'),
});

export type ReorderInput = z.infer<typeof reorderSchema>;

export interface ReorderResult {
  success: boolean;
  error?: string;
  message?: string;
  items_added: number;
  items_skipped: number;
  skipped_reasons?: string[];
}

const MAX_CART_QUANTITY = 10;

export async function reorder(
  input: ReorderInput,
  authInfo?: AuthInfo
): Promise<ReorderResult> {
  if (!authInfo || !authInfo.extra?.userId) {
    return { success: false, error: 'Authentication required', items_added: 0, items_skipped: 0 };
  }

  const userId = authInfo.extra.userId as string;

  try {
    const supabase = getSupabaseClient();
    const { order_id } = input;

    // Verify order ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return { success: false, error: 'Order not found', items_added: 0, items_skipped: 0 };
    }

    if (order.user_id !== userId) {
      return { success: false, error: 'Order not found', items_added: 0, items_skipped: 0 };
    }

    // Fetch order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, variant_id, quantity')
      .eq('order_id', order_id);

    if (itemsError || !orderItems || orderItems.length === 0) {
      return { success: false, error: 'No items found in order', items_added: 0, items_skipped: 0 };
    }

    // Fetch current cart items for merge
    const { data: currentCart } = await supabase
      .from('cart_items')
      .select('id, product_id, variant_id, quantity')
      .eq('user_id', userId);

    const cartMap = new Map<string, { id: string; quantity: number }>();
    for (const item of currentCart || []) {
      const key = `${item.product_id}:${item.variant_id || 'null'}`;
      cartMap.set(key, { id: item.id, quantity: item.quantity });
    }

    let itemsAdded = 0;
    let itemsSkipped = 0;
    const skippedReasons: string[] = [];

    for (const item of orderItems) {
      // Check if product is still active
      const { data: product } = await supabase
        .from('products')
        .select('id, status, title')
        .eq('id', item.product_id)
        .single();

      if (!product || product.status !== 'active') {
        itemsSkipped++;
        skippedReasons.push(`${product?.title || item.product_id}: no longer available`);
        continue;
      }

      // Check variant availability if applicable
      if (item.variant_id) {
        const { data: variant } = await supabase
          .from('product_variants')
          .select('id, is_enabled, is_available')
          .eq('id', item.variant_id)
          .single();

        if (!variant || !variant.is_enabled || !variant.is_available) {
          itemsSkipped++;
          skippedReasons.push(`${product.title}: variant no longer available`);
          continue;
        }
      }

      const key = `${item.product_id}:${item.variant_id || 'null'}`;
      const existing = cartMap.get(key);

      if (existing) {
        // Merge: cap at MAX_CART_QUANTITY
        const newQuantity = Math.min(existing.quantity + item.quantity, MAX_CART_QUANTITY);
        if (newQuantity > existing.quantity) {
          await supabase
            .from('cart_items')
            .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          itemsAdded++;
        } else {
          itemsSkipped++;
          skippedReasons.push(`${product.title}: already at max quantity`);
        }
      } else {
        // Insert new cart item
        const quantity = Math.min(item.quantity, MAX_CART_QUANTITY);
        const { error: insertError } = await supabase
          .from('cart_items')
          .insert({
            user_id: userId,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity,
          });

        if (insertError) {
          itemsSkipped++;
          skippedReasons.push(`${product.title}: failed to add`);
        } else {
          itemsAdded++;
        }
      }
    }

    return {
      success: true,
      message: `Added ${itemsAdded} item(s) to cart${itemsSkipped > 0 ? `, ${itemsSkipped} skipped` : ''}`,
      items_added: itemsAdded,
      items_skipped: itemsSkipped,
      skipped_reasons: skippedReasons.length > 0 ? skippedReasons : undefined,
    };
  } catch (err) {
    console.error('[reorder] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred', items_added: 0, items_skipped: 0 };
  }
}
