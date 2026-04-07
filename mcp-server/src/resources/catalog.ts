import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * MCP Resource: catalog://products
 * Returns paginated product list from the store catalog.
 *
 * Template variables:
 * - limit: number of products to return (default: 20, max: 100)
 * - offset: number of products to skip (default: 0)
 * - category: filter by category
 */
export async function readProductsCatalog(
  uri: URL,
  variables?: Record<string, string | number | boolean>
): Promise<ReadResourceResult> {
  try {
    const supabase = getSupabaseClient();

    // Get values from template variables (if using template) or query params (fallback)
    const limitParam = (variables?.limit?.toString() || uri.searchParams.get('limit') || '20');
    const offsetParam = (variables?.offset?.toString() || uri.searchParams.get('offset') || '0');
    const category = (variables?.category?.toString() || uri.searchParams.get('category'));

    const limit = Math.min(parseInt(limitParam, 10), 100); // Max 100
    const offset = parseInt(offsetParam, 10);

    // Build query
    let query = supabase
      .from('products')
      .select('id, title, description, base_price_cents, currency, images, category, tags, status, avg_rating, review_count, created_at, updated_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by category if provided
    if (category) {
      query = query.eq('category', category);
    }

    const { data: products, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    // Get total count for pagination metadata
    let countQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    if (category) {
      countQuery = countQuery.eq('category', category);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      throw new Error(`Failed to count products: ${countError.message}`);
    }

    // Format response
    const response = {
      success: true,
      products: products || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: offset + limit < (count || 0)
      },
      filters: {
        category: category || null
      }
    };

    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify({
            success: false,
            error: errorMessage
          }, null, 2)
        }
      ]
    };
  }
}
