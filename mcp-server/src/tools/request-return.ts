import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { userContent } from '../lib/product-helpers.js';

export const requestReturnSchema = z.object({
  order_id: z.string().uuid().describe('The UUID of the order to return'),
  reason: z.string().min(10).max(1000).describe('Reason for the return (minimum 10 characters)'),
});

export type RequestReturnInput = z.infer<typeof requestReturnSchema>;

export interface RequestReturnResult {
  success: boolean;
  error?: string;
  return_request?: {
    id: string;
    order_id: string;
    status: string;
    reason: string;
    created_at: string;
  };
}

/** Statuses eligible for return */
const RETURNABLE_STATUSES = ['delivered', 'shipped'];

export async function requestReturn(
  input: RequestReturnInput,
  authInfo?: AuthInfo
): Promise<RequestReturnResult> {
  if (!authInfo || !authInfo.extra?.userId) {
    return { success: false, error: 'Authentication required' };
  }

  const userId = authInfo.extra.userId as string;

  try {
    const supabase = getSupabaseClient();
    const { order_id, reason } = input;

    // Verify order ownership and status
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, status')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.user_id !== userId) {
      return { success: false, error: 'Order not found' };
    }

    if (!RETURNABLE_STATUSES.includes(order.status)) {
      return {
        success: false,
        error: `Order cannot be returned. Current status: ${order.status}. Only delivered or shipped orders are eligible.`,
      };
    }

    // Check for existing pending return
    const { data: existingReturn } = await supabase
      .from('return_requests')
      .select('id, status')
      .eq('order_id', order_id)
      .in('status', ['pending', 'approved', 'processing'])
      .maybeSingle();

    if (existingReturn) {
      return {
        success: false,
        error: `A return request already exists for this order (status: ${existingReturn.status})`,
      };
    }

    // Create return request
    const { data: returnReq, error: insertError } = await supabase
      .from('return_requests')
      .insert({
        order_id,
        user_id: userId,
        reason,
        status: 'pending',
      })
      .select('id, order_id, status, reason, created_at')
      .single();

    if (insertError) {
      console.error('[request_return] Insert error:', insertError);
      return { success: false, error: 'Failed to create return request' };
    }

    return {
      success: true,
      return_request: {
        id: returnReq.id,
        order_id: returnReq.order_id,
        status: returnReq.status,
        reason: userContent(returnReq.reason),
        created_at: returnReq.created_at,
      },
    };
  } catch (err) {
    console.error('[request_return] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
