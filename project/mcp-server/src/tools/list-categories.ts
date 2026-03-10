import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * MCP Tool: list_categories
 *
 * List all product categories with product counts.
 * Useful for browsing the store without a search query.
 *
 * This is a PUBLIC tool (no authentication required).
 */

export const listCategoriesSchema = z.object({});

export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;

export interface ListCategoriesResult {
  success: boolean;
  categories: Array<{
    name: string;
    slug: string;
    product_count: number;
    image_url: string | null;
  }>;
}

/**
 * Generate a URL-friendly slug from category name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function listCategories(_input: ListCategoriesInput): Promise<ListCategoriesResult> {
  try {
    const supabase = getSupabaseClient();

    // Use RPC or optimized query to get category counts without fetching all products
    // First try: use a lightweight query selecting only category column
    const { data: categoryData, error } = await supabase
      .from('products')
      .select('category')
      .eq('status', 'active')
      .not('category', 'is', null)
      .not('category', 'eq', '');

    if (error) {
      console.error('[list_categories] Supabase error:', error);
      return {
        success: false,
        categories: [],
      };
    }

    // Group by category and count (no image data fetched — O(1) per row instead of O(n))
    const categoryMap = new Map<string, number>();

    for (const product of categoryData || []) {
      const category = product.category?.trim();
      if (!category) continue;
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    }

    // Convert map to array and sort by product count (descending)
    const categories = Array.from(categoryMap.entries())
      .map(([name, count]) => ({
        name,
        slug: generateSlug(name),
        product_count: count,
        image_url: null as string | null,
      }))
      .sort((a, b) => b.product_count - a.product_count);

    return {
      success: true,
      categories,
    };
  } catch (error) {
    console.error('[list_categories] Unexpected error:', error);
    return {
      success: false,
      categories: [],
    };
  }
}
