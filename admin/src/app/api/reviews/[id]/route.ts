import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth-middleware';
import { withPermission } from '@/lib/rbac';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * PUT /api/reviews/:id — Moderate review (approve/reject/respond)
 * Body:
 *  - moderation_status: 'approved' | 'rejected'
 *  - moderation_notes?: string (optional)
 *  - moderated_by: string (user ID)
 */
export const PUT = withPermission('reviews', 'moderate', async (req, session, context) => {
  const { id } = await context.params;

  try {
    const body = await req.json();
    const { moderation_status, moderation_notes } = body;

    if (!moderation_status || !['approved', 'rejected'].includes(moderation_status)) {
      return NextResponse.json(
        { error: 'Invalid moderation_status. Must be "approved" or "rejected".' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('product_reviews')
      .update({
        moderation_status,
        moderation_notes: moderation_notes || null,
        moderated_by: session.userId,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating review:', error);
      return NextResponse.json(
        { error: 'Failed to update review' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Review moderated successfully',
      review: data,
    });
  } catch (error) {
    console.error('Error moderating review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
