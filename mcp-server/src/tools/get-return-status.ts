import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { userContent } from '../lib/product-helpers.js';

export const getReturnStatusSchema = z.object({
  order_id: z.string().uuid().describe('The UUID of the order to check return status for'),
});

export type GetReturnStatusInput = z.infer<typeof getReturnStatusSchema>;

export interface GetReturnStatusResult {
  success: boolean;
  error?: string;
  return_request?: {
    id: string;
    order_id: string;
    status: string;
    reason: string;
    has_admin_response?: boolean;
    created_at: string;
    updated_at: string;
  } | null;
}

export async function getReturnStatus(
  input: GetReturnStatusInput,
  authInfo?: AuthInfo
): Promise<GetReturnStatusResult> {
  if (!authInfo || !authInfo.extra?.userId) {
    return { success: false, error: 'Authentication required' };
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
      return { success: false, error: 'Order not found' };
    }

    if (order.user_id !== userId) {
      return { success: false, error: 'Order not found' };
    }

    // Fetch return request
    const { data: returnReq, error: returnError } = await supabase
      .from('return_requests')
      .select('id, order_id, status, reason, admin_notes, created_at, updated_at')
      .eq('order_id', order_id)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (returnError) {
      console.error('[get_return_status] Database error:', returnError);
      return { success: false, error: 'Failed to fetch return status' };
    }

    if (!returnReq) {
      return { success: true, return_request: null };
    }

    return {
      success: true,
      return_request: {
        id: returnReq.id,
        order_id: returnReq.order_id,
        status: returnReq.status,
        reason: userContent(returnReq.reason),
        has_admin_response: !!returnReq.admin_notes,
        created_at: returnReq.created_at,
        updated_at: returnReq.updated_at,
      },
    };
  } catch (err) {
    console.error('[get_return_status] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
