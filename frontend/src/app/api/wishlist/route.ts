import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, requireAuth, authErrorResponse } from '@/lib/auth-guard';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET /api/wishlist - Get all wishlists for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ wishlists: [] });
    }

    // Get user's wishlists with items
    const { data: wishlists, error } = await supabaseAdmin
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
            base_price_cents,
            currency,
            images,
            avg_rating,
            review_count,
            category
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wishlists:', error);
      return NextResponse.json(
        { error: 'Failed to fetch wishlists' },
        { status: 500 }
      );
    }

    // Normalize products to match ProductCard format
    const normalizedWishlists = (wishlists || []).map((wl: any) => ({
      ...wl,
      wishlist_items: (wl.wishlist_items || []).map((item: any) => {
        const p = item.products;
        if (!p) return item;

        const images = Array.isArray(p.images)
          ? p.images.map((img: any) =>
              typeof img === 'string' ? img : (img.src || img.url || '')
            )
          : [];

        return {
          ...item,
          products: {
            id: p.id,
            title: p.title,
            description: p.description || '',
            price: (p.base_price_cents || 0) / 100,
            currency: p.currency?.toUpperCase() || 'EUR',
            image: images[0] || '',
            images,
            rating: Number(p.avg_rating) || 0,
            reviewCount: p.review_count || 0,
            category: p.category?.toLowerCase(),
          },
        };
      }),
    }));

    return NextResponse.json({ wishlists: normalizedWishlists });
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
    const user = await requireAuth(request);

    const body = await request.json();
    const { name = 'My Wishlist', is_public = false } = body;

    const { data: wishlist, error } = await supabaseAdmin
      .from('wishlists')
      .insert({
        user_id: user.id,
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
    return authErrorResponse(error);
  }
}

// DELETE /api/wishlist - Delete a wishlist
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const wishlist_id = searchParams.get('wishlist_id');

    if (!wishlist_id) {
      return NextResponse.json({ error: 'wishlist_id is required' }, { status: 400 });
    }

    // Verify ownership
    const { data: wishlist } = await supabaseAdmin
      .from('wishlists')
      .select('id')
      .eq('id', wishlist_id)
      .eq('user_id', user.id)
      .single();

    if (!wishlist) {
      return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
    }

    // Delete items first, then wishlist
    await supabaseAdmin.from('wishlist_items').delete().eq('wishlist_id', wishlist_id);
    const { error } = await supabaseAdmin.from('wishlists').delete().eq('id', wishlist_id);

    if (error) {
      console.error('Error deleting wishlist:', error);
      return NextResponse.json({ error: 'Failed to delete wishlist' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/wishlist - Rename a wishlist
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { wishlist_id, name } = body;

    if (!wishlist_id || !name?.trim()) {
      return NextResponse.json({ error: 'wishlist_id and name are required' }, { status: 400 });
    }

    const { data: wishlist, error } = await supabaseAdmin
      .from('wishlists')
      .update({ name: name.trim() })
      .eq('id', wishlist_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !wishlist) {
      console.error('Error renaming wishlist:', error);
      return NextResponse.json({ error: 'Failed to rename wishlist' }, { status: 500 });
    }

    return NextResponse.json({ success: true, wishlist });
  } catch (error) {
    return authErrorResponse(error);
  }
}
