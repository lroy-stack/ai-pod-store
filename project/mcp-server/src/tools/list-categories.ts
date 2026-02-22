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

    // Query distinct categories with product counts
    // Only include products with status='active'
    const { data: categoryData, error } = await supabase
      .from('products')
      .select('category, images')
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

    // Group by category and count products
    const categoryMap = new Map<string, { count: number; imageUrl: string | null }>();

    for (const product of categoryData || []) {
      const category = product.category?.trim();
      if (!category) continue;

      const existing = categoryMap.get(category);
      const count = existing ? existing.count + 1 : 1;

      // Use first product's first image as category image (if not already set)
      let imageUrl = existing?.imageUrl || null;
      if (!imageUrl && Array.isArray(product.images) && product.images.length > 0) {
        const firstImage = product.images[0];
        imageUrl = firstImage.src || firstImage.url || null;
      }

      categoryMap.set(category, { count, imageUrl });
    }

    // Convert map to array and sort by product count (descending)
    const categories = Array.from(categoryMap.entries())
      .map(([name, { count, imageUrl }]) => ({
        name,
        slug: generateSlug(name),
        product_count: count,
        image_url: imageUrl,
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
