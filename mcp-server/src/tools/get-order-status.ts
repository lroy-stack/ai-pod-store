import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * MCP Tool: get_order_status
 *
 * Get detailed information about a specific order, including line items.
 *
 * This is a PROTECTED tool — authentication required.
 * Returns 401 error if no valid Bearer token provided.
 * Returns 403 error if the order belongs to another user.
 */

export const getOrderStatusSchema = z.object({
  order_id: z.string().uuid().describe('The UUID of the order to retrieve'),
});

export type GetOrderStatusInput = z.infer<typeof getOrderStatusSchema>;

export interface OrderLineItem {
  id: string;
  product_id: string;
  product_title?: string;
  variant_id?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface OrderDetails {
  id: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  paid_at?: string;
  shipped_at?: string;
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;
  shipping_summary?: { city: string | null; country: string | null };
  line_items: OrderLineItem[];
}

export interface GetOrderStatusResult {
  success: boolean;
  error?: string;
  order?: OrderDetails;
}

export async function getOrderStatus(
  input: GetOrderStatusInput,
  authInfo?: AuthInfo
): Promise<GetOrderStatusResult> {
  // Check authentication
  if (!authInfo || !authInfo.extra?.userId) {
    return {
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    };
  }

  const userId = authInfo.extra.userId as string;
  const { order_id } = input;

  try {
    const supabase = getSupabaseClient();

    // Fetch the order (ownership enforced in query via user_id filter)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, status, total_cents, currency, created_at, paid_at, shipped_at, tracking_number, tracking_url, carrier, shipping_address, customer_email'
      )
      .eq('id', order_id)
      .eq('user_id', userId)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return {
          success: false,
          error: 'Order not found',
        };
      }
      console.error('[get_order_status] Database error:', orderError);
      return {
        success: false,
        error: 'Failed to fetch order',
      };
    }

    if (!orderData) {
      return {
        success: false,
        error: 'Order not found',
      };
    }

    // Fetch order items with product details
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select(
        `
        id,
        product_id,
        variant_id,
        quantity,
        unit_price_cents,
        products:product_id (
          title
        )
      `
      )
      .eq('order_id', order_id);

    if (itemsError) {
      console.error('[get_order_status] Failed to fetch order items:', itemsError);
      return {
        success: false,
        error: 'Failed to fetch order items',
      };
    }

    // Transform line items
    const line_items: OrderLineItem[] = (itemsData || []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      product_title: item.products?.title,
      variant_id: item.variant_id || undefined,
      quantity: item.quantity,
      unit_price: item.unit_price_cents / 100,
      total_price: (item.unit_price_cents * item.quantity) / 100,
    }));

    // Build order details
    const order: OrderDetails = {
      id: orderData.id,
      status: orderData.status,
      total: orderData.total_cents / 100,
      currency: orderData.currency.toUpperCase(),
      created_at: orderData.created_at,
      ...(orderData.paid_at && { paid_at: orderData.paid_at }),
      ...(orderData.shipped_at && { shipped_at: orderData.shipped_at }),
      ...(orderData.tracking_number && { tracking_number: orderData.tracking_number }),
      ...(orderData.tracking_url && { tracking_url: orderData.tracking_url }),
      ...(orderData.carrier && { carrier: orderData.carrier }),
      ...(orderData.shipping_address && {
        shipping_summary: {
          city: (orderData.shipping_address as Record<string, unknown>).city as string || null,
          country: ((orderData.shipping_address as Record<string, unknown>).country_code
            || (orderData.shipping_address as Record<string, unknown>).country) as string || null,
        },
      }),
      line_items,
    };

    return {
      success: true,
      order,
    };
  } catch (err) {
    console.error('[get_order_status] Unexpected error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
