import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/wishlist - Get all wishlists for current user
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('sb-session');

    if (!sessionCookie) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    // Parse session to get user_id
    let userId: string | null = null;
    try {
      const sessionData = JSON.parse(sessionCookie.value);
      userId = sessionData.user?.id;
    } catch {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    if (!userId) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    // Get user's wishlists with items
    const { data: wishlists, error } = await supabase
      .from('wishlists')
      .select(`
        id,
        name,
        is_public,
        share_token,
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
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wishlists:', error);
      return NextResponse.json(
        { error: 'Failed to fetch wishlists' },
        { status: 500 }
      );
    }

    return NextResponse.json({ wishlists: wishlists || [] });
  } catch (error) {
    console.error('Wishlist API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/wishlist - Create new wishlist
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
    const { name = 'My Wishlist', is_public = false } = body;

    const { data: wishlist, error } = await supabase
      .from('wishlists')
      .insert({
        user_id: userId,
        name,
        is_public,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating wishlist:', error);
      return NextResponse.json(
        { error: 'Failed to create wishlist' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, wishlist }, { status: 201 });
  } catch (error) {
    console.error('Create wishlist error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
