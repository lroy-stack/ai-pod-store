import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/wishlist/shared/[token] - Get public wishlist by share token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: 'Share token required' },
        { status: 400 }
      );
    }

    // Fetch wishlist by share_token
    const { data: wishlist, error } = await supabase
      .from('wishlists')
      .select(`
        id,
        name,
        is_public,
        created_at,
        wishlist_items (
          id,
          product_id,
          variant_id,
          added_at,
          products (
            id,
            title,
            description,
            base_price,
            images
          )
        )
      `)
      .eq('share_token', token)
      .eq('is_public', true)
      .single();

    if (error || !wishlist) {
      return NextResponse.json(
        { error: 'Wishlist not found or is not public' },
        { status: 404 }
      );
    }

    return NextResponse.json({ wishlist });
  } catch (error) {
    console.error('Shared wishlist API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
