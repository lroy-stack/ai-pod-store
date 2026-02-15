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
