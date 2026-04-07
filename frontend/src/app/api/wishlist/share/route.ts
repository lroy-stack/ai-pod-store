import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse } from '@/lib/auth-guard';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { randomBytes } from 'crypto';
import { BASE_URL } from '@/lib/store-config';

// POST /api/wishlist/share - Generate share token for a wishlist
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { wishlist_id } = body;

    if (!wishlist_id) {
      return NextResponse.json(
        { error: 'Wishlist ID required' },
        { status: 400 }
      );
    }

    // Verify the wishlist belongs to the user
    const { data: wishlist, error: fetchError } = await supabaseAdmin
      .from('wishlists')
      .select('id, share_token, is_public')
      .eq('id', wishlist_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !wishlist) {
      return NextResponse.json(
        { error: 'Wishlist not found' },
        { status: 404 }
      );
    }

    // If share_token already exists, return it
    if (wishlist.share_token) {
      const shareUrl = `${BASE_URL}/en/wishlist/shared/${wishlist.share_token}`;
      return NextResponse.json({
        success: true,
        share_token: wishlist.share_token,
        share_url: shareUrl,
      });
    }

    // Generate a new share token
    const shareToken = randomBytes(16).toString('hex');

    // Update wishlist with share token and set is_public to true
    const { error: updateError } = await supabaseAdmin
      .from('wishlists')
      .update({
        share_token: shareToken,
        is_public: true,
      })
      .eq('id', wishlist_id);

    if (updateError) {
      console.error('Error updating wishlist:', updateError);
      return NextResponse.json(
        { error: 'Failed to generate share link' },
        { status: 500 }
      );
    }

    const shareUrl = `${BASE_URL}/en/wishlist/shared/${shareToken}`;

    return NextResponse.json({
      success: true,
      share_token: shareToken,
      share_url: shareUrl,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
