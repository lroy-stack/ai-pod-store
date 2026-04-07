import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * MCP Tool: list_my_orders
 *
 * Get the authenticated user's order history.
 *
 * This is a PROTECTED tool — authentication required.
 * Returns 401 error if no valid Bearer token provided.
 */

export const listMyOrdersSchema = z.object({
  // Optional filters
  limit: z.number().int().min(1).max(50).optional().describe('Maximum number of orders to return (default: 20)'),
  status: z.enum(['pending', 'paid', 'submitted', 'in_production', 'shipped', 'delivered', 'cancelled', 'refunded']).optional().describe('Filter by order status'),
});

export type ListMyOrdersInput = z.infer<typeof listMyOrdersSchema>;

export interface OrderItem {
  id: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;
  item_count?: number;
}

export interface ListMyOrdersResult {
  success: boolean;
  error?: string;
  orders?: OrderItem[];
}

export async function listMyOrders(
  input: ListMyOrdersInput,
  authInfo?: AuthInfo
): Promise<ListMyOrdersResult> {
  // Check authentication
  if (!authInfo || !authInfo.extra?.userId) {
    return {
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    };
  }

  const userId = authInfo.extra.userId as string;
  const limit = input.limit || 20;

  try {
    const supabase = getSupabaseClient();

    // Build query
    let query = supabase
      .from('orders')
      .select('id, status, total_cents, currency, created_at, tracking_number, tracking_url, carrier')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply status filter if provided
    if (input.status) {
      query = query.eq('status', input.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[list_my_orders] Database error:', error);
      return {
        success: false,
        error: 'Failed to fetch orders',
      };
    }

    if (!data) {
      return {
        success: true,
        orders: [],
      };
    }

    // Transform data to include decimal total
    const orders: OrderItem[] = data.map((order) => ({
      id: order.id,
      status: order.status,
      total: order.total_cents / 100, // Convert cents to decimal
      currency: order.currency.toUpperCase(),
      created_at: order.created_at,
      ...(order.tracking_number && { tracking_number: order.tracking_number }),
      ...(order.tracking_url && { tracking_url: order.tracking_url }),
      ...(order.carrier && { carrier: order.carrier }),
    }));

    return {
      success: true,
      orders,
    };
  } catch (err) {
    console.error('[list_my_orders] Unexpected error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
