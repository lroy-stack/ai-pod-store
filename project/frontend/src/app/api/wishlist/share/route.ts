import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/wishlist/share - Generate share token for a wishlist
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('sb-session');

    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    let userId: string | null = null;
    try {
      const sessionData = JSON.parse(sessionCookie.value);
      userId = sessionData.user?.id;
    } catch {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { wishlist_id } = body;

    if (!wishlist_id) {
      return NextResponse.json(
        { error: 'Wishlist ID required' },
        { status: 400 }
      );
    }

    // Verify the wishlist belongs to the user
    const { data: wishlist, error: fetchError } = await supabase
      .from('wishlists')
      .select('id, share_token, is_public')
      .eq('id', wishlist_id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !wishlist) {
      return NextResponse.json(
        { error: 'Wishlist not found' },
        { status: 404 }
      );
    }

    // If share_token already exists, return it
    if (wishlist.share_token) {
      const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/en/wishlist/shared/${wishlist.share_token}`;
      return NextResponse.json({
        success: true,
        share_token: wishlist.share_token,
        share_url: shareUrl,
      });
    }

    // Generate a new share token
    const shareToken = randomBytes(16).toString('hex');

    // Update wishlist with share token and set is_public to true
    const { error: updateError } = await supabase
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

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/en/wishlist/shared/${shareToken}`;

    return NextResponse.json({
      success: true,
      share_token: shareToken,
      share_url: shareUrl,
    });
  } catch (error) {
    console.error('Share wishlist error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
