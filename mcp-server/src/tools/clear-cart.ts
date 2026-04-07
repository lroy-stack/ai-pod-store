import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

export const clearCartSchema = z.object({});

export type ClearCartInput = z.infer<typeof clearCartSchema>;

export interface ClearCartResult {
  success: boolean;
  error?: string;
  message?: string;
  items_removed: number;
}

export async function clearCart(
  _input: ClearCartInput,
  authInfo?: AuthInfo
): Promise<ClearCartResult> {
  if (!authInfo || !authInfo.extra?.userId) {
    return { success: false, error: 'Authentication required', items_removed: 0 };
  }

  const userId = authInfo.extra.userId as string;

  try {
    const supabase = getSupabaseClient();

    // Count items before deleting
    const { count } = await supabase
      .from('cart_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const itemCount = count || 0;

    if (itemCount === 0) {
      return { success: true, message: 'Cart is already empty', items_removed: 0 };
    }

    // Delete all cart items
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[clear_cart] Database error:', error);
      return { success: false, error: 'Failed to clear cart', items_removed: 0 };
    }

    return {
      success: true,
      message: `Removed ${itemCount} item(s) from cart`,
      items_removed: itemCount,
    };
  } catch (err) {
    console.error('[clear_cart] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred', items_removed: 0 };
  }
}
