import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse } from '@/lib/auth-guard';
import { supabaseAdmin } from '@/lib/supabase-admin';

// POST /api/wishlist/items - Add item to wishlist
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { wishlist_id, product_id, variant_id } = body;

    if (!wishlist_id || !product_id) {
      return NextResponse.json(
        { error: 'wishlist_id and product_id are required' },
        { status: 400 }
      );
    }

    // Verify wishlist belongs to user
    const { data: wishlist, error: wishlistError } = await supabaseAdmin
      .from('wishlists')
      .select('id')
      .eq('id', wishlist_id)
      .eq('user_id', user.id)
      .single();

    if (wishlistError || !wishlist) {
      return NextResponse.json(
        { error: 'Wishlist not found' },
        { status: 404 }
      );
    }

    // Check if item already exists — use .is(null) for NULL variant_id
    let existingQuery = supabaseAdmin
      .from('wishlist_items')
      .select('id')
      .eq('wishlist_id', wishlist_id)
      .eq('product_id', product_id);

    if (variant_id) {
      existingQuery = existingQuery.eq('variant_id', variant_id);
    } else {
      existingQuery = existingQuery.is('variant_id', null);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Item already in wishlist' },
        { status: 409 }
      );
    }

    // Add item to wishlist
    const { data: item, error } = await supabaseAdmin
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
    return authErrorResponse(error);
  }
}

// DELETE /api/wishlist/items - Remove item from wishlist
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const item_id = searchParams.get('item_id');

    if (!item_id) {
      return NextResponse.json(
        { error: 'item_id is required' },
        { status: 400 }
      );
    }

    // Verify item belongs to user's wishlist
    const { data: item } = await supabaseAdmin
      .from('wishlist_items')
      .select('wishlist_id, wishlists!inner(user_id)')
      .eq('id', item_id)
      .single();

    if (!item || (item.wishlists as any).user_id !== user.id) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Delete item
    const { error } = await supabaseAdmin
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
    return authErrorResponse(error);
  }
}
