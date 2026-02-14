import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/wishlist/items - Add item to wishlist
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
    const { wishlist_id, product_id, variant_id } = body;

    if (!wishlist_id || !product_id) {
      return NextResponse.json(
        { error: 'wishlist_id and product_id are required' },
        { status: 400 }
      );
    }

    // Verify wishlist belongs to user
    const { data: wishlist, error: wishlistError } = await supabase
      .from('wishlists')
      .select('id')
      .eq('id', wishlist_id)
      .eq('user_id', userId)
      .single();

    if (wishlistError || !wishlist) {
      return NextResponse.json(
        { error: 'Wishlist not found' },
        { status: 404 }
      );
    }

    // Check if item already exists
    const { data: existing } = await supabase
      .from('wishlist_items')
      .select('id')
      .eq('wishlist_id', wishlist_id)
      .eq('product_id', product_id)
      .eq('variant_id', variant_id || null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Item already in wishlist' },
        { status: 409 }
      );
    }

    // Add item to wishlist
    const { data: item, error } = await supabase
      .from('wishlist_items')
      .insert({
        wishlist_id,
        product_id,
        variant_id: variant_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding item to wishlist:', error);
      return NextResponse.json(
        { error: 'Failed to add item to wishlist' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error) {
    console.error('Wishlist items API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/wishlist/items - Remove item from wishlist
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const item_id = searchParams.get('item_id');

    if (!item_id) {
      return NextResponse.json(
        { error: 'item_id is required' },
        { status: 400 }
      );
    }

    // Verify item belongs to user's wishlist
    const { data: item } = await supabase
      .from('wishlist_items')
      .select('wishlist_id, wishlists!inner(user_id)')
      .eq('id', item_id)
      .single();

    if (!item || (item.wishlists as any).user_id !== userId) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Delete item
    const { error } = await supabase
      .from('wishlist_items')
      .delete()
      .eq('id', item_id);

    if (error) {
      console.error('Error removing item from wishlist:', error);
      return NextResponse.json(
        { error: 'Failed to remove item from wishlist' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Wishlist items DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
