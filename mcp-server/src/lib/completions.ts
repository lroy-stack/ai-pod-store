/**
 * MCP Completion Handler
 * Provides auto-complete suggestions for tool arguments
 */

import { getSupabaseClient, getAnonClient } from './supabase.js';

function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

export interface CompletionRequest {
  ref: {
    type: 'ref/tool';
    name: string;
    argument: string;
  };
  argument: {
    name: string;
    value: string;
  };
}

export interface CompletionResult {
  completion: {
    values: string[];
    total?: number;
    hasMore?: boolean;
  };
}

/**
 * Get completion suggestions based on the request
 */
export async function getCompletions(
  request: CompletionRequest,
  userId?: string
): Promise<CompletionResult> {
  const { ref, argument } = request;

  // Handle different tool arguments
  if (ref.type === 'ref/tool') {
    // Category completions (for search_products)
    if (argument.name === 'category' || ref.argument === 'category') {
      return await getCategoryCompletions(argument.value);
    }

    // Order ID completions (for get_order_status, track_shipment)
    if (
      argument.name === 'order_id' ||
      ref.argument === 'order_id'
    ) {
      return await getOrderIdCompletions(argument.value, userId);
    }

    // Product ID completions
    if (
      argument.name === 'product_id' ||
      ref.argument === 'product_id'
    ) {
      return await getProductIdCompletions(argument.value);
    }
  }

  // No suggestions for unknown arguments
  return {
    completion: {
      values: [],
      total: 0,
      hasMore: false,
    },
  };
}

/**
 * Get category completions
 */
async function getCategoryCompletions(partial: string): Promise<CompletionResult> {
  const supabase = getAnonClient();

  // Fetch distinct categories from products
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .not('category', 'is', null)
    .ilike('category', `${escapeLike(partial)}%`)
    .limit(10);

  if (error || !data) {
    return {
      completion: {
        values: [],
        total: 0,
        hasMore: false,
      },
    };
  }

  // Extract unique categories
  const categories = Array.from(new Set(data.map((p: any) => p.category).filter(Boolean)));

  return {
    completion: {
      values: categories,
      total: categories.length,
      hasMore: categories.length >= 10,
    },
  };
}

/**
 * Get order ID completions (recent orders, scoped to authenticated user)
 */
async function getOrderIdCompletions(partial: string, userId?: string): Promise<CompletionResult> {
  // If no userId, return empty to prevent cross-user data leak
  if (!userId) {
    return {
      completion: {
        values: [],
        total: 0,
        hasMore: false,
      },
    };
  }

  const supabase = getSupabaseClient();

  // Fetch recent orders matching the partial UUID, filtered by user
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, created_at')
    .eq('user_id', userId)
    .ilike('id', `${escapeLike(partial)}%`)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error || !data) {
    return {
      completion: {
        values: [],
        total: 0,
        hasMore: false,
      },
    };
  }

  const orderIds = data.map((o: any) => o.id);

  return {
    completion: {
      values: orderIds,
      total: orderIds.length,
      hasMore: orderIds.length >= 5,
    },
  };
}

/**
 * Get product ID completions
 */
async function getProductIdCompletions(partial: string): Promise<CompletionResult> {
  const supabase = getAnonClient();

  // Fetch products matching the partial UUID or title
  const { data, error } = await supabase
    .from('products')
    .select('id, title')
    .or(`id.ilike.${escapeLike(partial)}%,title.ilike.%${escapeLike(partial)}%`)
    .eq('status', 'active')
    .limit(10);

  if (error || !data) {
    return {
      completion: {
        values: [],
        total: 0,
        hasMore: false,
      },
    };
  }

  const productIds = data.map((p: any) => p.id);

  return {
    completion: {
      values: productIds,
      total: productIds.length,
      hasMore: productIds.length >= 10,
    },
  };
}
