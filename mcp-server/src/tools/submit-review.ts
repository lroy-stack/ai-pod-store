import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

export const submitReviewSchema = z.object({
  product_id: z.string().uuid().describe('The UUID of the product to review'),
  rating: z.number().int().min(1).max(5).describe('Rating from 1 to 5 stars'),
  comment: z.string().min(10).max(2000).describe('Review comment (minimum 10 characters)'),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

export interface SubmitReviewResult {
  success: boolean;
  error?: string;
  review?: {
    id: string;
    product_id: string;
    rating: number;
    status: string;
    created_at: string;
  };
}

/** Order statuses that count as "purchased" for review verification */
const PURCHASE_VERIFIED_STATUSES = ['shipped', 'delivered', 'completed'];

export async function submitReview(
  input: SubmitReviewInput,
  authInfo?: AuthInfo
): Promise<SubmitReviewResult> {
  if (!authInfo || !authInfo.extra?.userId) {
    return { success: false, error: 'Authentication required' };
  }

  const userId = authInfo.extra.userId as string;

  try {
    const supabase = getSupabaseClient();
    const { product_id, rating, comment } = input;

    // Verify product exists
    const { data: product } = await supabase
      .from('products')
      .select('id, status')
      .eq('id', product_id)
      .single();

    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    // Check for duplicate review (product_reviews table — matches frontend)
    const { data: existingReview } = await supabase
      .from('product_reviews')
      .select('id')
      .eq('product_id', product_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingReview) {
      return { success: false, error: 'You have already reviewed this product' };
    }

    // Verify purchase — check if user has a completed order containing THIS product
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_items!inner(product_id)')
      .eq('user_id', userId)
      .eq('order_items.product_id', product_id)
      .in('status', PURCHASE_VERIFIED_STATUSES)
      .limit(1);

    const hasPurchased = orders && orders.length > 0;

    // Insert review into product_reviews (body field, not comment)
    const { data: review, error: insertError } = await supabase
      .from('product_reviews')
      .insert({
        product_id,
        user_id: userId,
        rating,
        body: comment.trim(),
        is_verified_purchase: hasPurchased || false,
      })
      .select('id, product_id, rating, moderation_status, created_at')
      .single();

    if (insertError) {
      // Handle unique constraint
      if (insertError.code === '23505') {
        return { success: false, error: 'You have already reviewed this product' };
      }
      console.error('[submit_review] Insert error:', insertError);
      return { success: false, error: 'Failed to submit review' };
    }

    return {
      success: true,
      review: {
        id: review.id,
        product_id: review.product_id,
        rating: review.rating,
        status: review.moderation_status || 'pending',
        created_at: review.created_at,
      },
    };
  } catch (err) {
    console.error('[submit_review] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
