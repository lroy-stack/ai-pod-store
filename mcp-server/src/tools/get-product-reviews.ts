import { z } from 'zod';
import { getAnonClient } from '../lib/supabase.js';
import { userContent } from '../lib/product-helpers.js';

/**
 * MCP Tool: get_product_reviews
 *
 * Get reviews for a product. Returns paginated list of reviews with rating, text, and author name.
 *
 * This is a PUBLIC tool (no authentication required).
 */

export const getProductReviewsSchema = z.object({
  product_id: z.string().uuid().describe('Product UUID to get reviews for'),
  page: z.number().int().positive().optional().default(1).describe('Page number for pagination (default: 1)'),
  limit: z.number().int().min(1).max(20).optional().default(10).describe('Reviews per page (max: 20, default: 10)'),
});

export type GetProductReviewsInput = z.infer<typeof getProductReviewsSchema>;

export interface GetProductReviewsResult {
  success: boolean;
  reviews: Array<{
    id: string;
    rating: number;
    title: string | null;
    body: string;
    author_name: string;
    created_at: string;
  }>;
  average_rating: number;
  total_reviews: number;
  page: number;
}

export async function getProductReviews(input: GetProductReviewsInput): Promise<GetProductReviewsResult> {
  try {
    const supabase = getAnonClient();
    const { product_id, page = 1, limit = 10 } = input;

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Get total review count and average rating for the product
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('avg_rating, review_count')
      .eq('id', product_id)
      .single();

    if (productError || !productData) {
      console.error('[get_product_reviews] Product not found:', productError);
      return {
        success: false,
        reviews: [],
        average_rating: 0,
        total_reviews: 0,
        page,
      };
    }

    // Get paginated reviews
    const { data: reviews, error: reviewsError } = await supabase
      .from('product_reviews')
      .select('id, rating, title, body, created_at, user_id')
      .eq('product_id', product_id)
      .eq('moderation_status', 'approved') // Only show approved reviews
      .order('created_at', { ascending: false }) // Newest first
      .range(offset, offset + limit - 1);

    if (reviewsError) {
      console.error('[get_product_reviews] Error fetching reviews:', reviewsError);
      return {
        success: false,
        reviews: [],
        average_rating: Number(productData.avg_rating) || 0,
        total_reviews: productData.review_count || 0,
        page,
      };
    }

    // Get user names for reviews
    const userIds = [...new Set(reviews?.map((r) => r.user_id).filter(Boolean) || [])];
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds);

    const userMap = new Map(users?.map((u) => [u.id, u.name]) || []);

    // Map reviews to response format
    const mappedReviews = (reviews || []).map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title ? userContent(r.title) : null,
      body: userContent(r.body),
      author_name: userContent(userMap.get(r.user_id) || 'Anonymous'),
      created_at: r.created_at,
    }));

    return {
      success: true,
      reviews: mappedReviews,
      average_rating: Number(productData.avg_rating) || 0,
      total_reviews: productData.review_count || 0,
      page,
    };
  } catch (error) {
    console.error('[get_product_reviews] Unexpected error:', error);
    return {
      success: false,
      reviews: [],
      average_rating: 0,
      total_reviews: 0,
      page: input.page || 1,
    };
  }
}
