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
            slug,
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
      .eq('share_token', token)
      .eq('is_public', true)
      .single();

    if (error || !wishlist) {
      return NextResponse.json(
        { error: 'Wishlist not found or is not public' },
        { status: 404 }
      );
    }

    // Normalize to ProductCard format (same as /api/wishlist)
    const normalized = {
      ...wishlist,
      wishlist_items: (wishlist.wishlist_items || []).map((item: any) => {
        const p = item.products;
        if (!p) return item;
        const images = Array.isArray(p.images)
          ? p.images.map((img: any) => typeof img === 'string' ? img : (img.src || img.url || ''))
          : [];
        return {
          ...item,
          products: {
            id: p.id,
            slug: p.slug || p.id,
            title: p.title,
            description: p.description || '',
            price: (p.base_price_cents || 0) / 100,
            currency: (p.currency || 'EUR').toUpperCase(),
            image: images[0] || null,
            rating: Number(p.avg_rating) || 0,
            reviewCount: p.review_count || 0,
            category: p.category?.toLowerCase(),
          },
        };
      }),
    };

    return NextResponse.json({ wishlist: normalized });
  } catch (error) {
    console.error('Shared wishlist API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
