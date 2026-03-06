import { createClient } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async (req, session, context) => {
  const { email: rawEmail } = await context.params;
  const email = decodeURIComponent(rawEmail);
  try {
    const supabase = createClient();

    // Get user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, avatar_url, locale, currency, phone, email_verified, created_at, last_login_at')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = user.id;

    // Get order count and total spent
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_cents, currency')
      .eq('user_id', userId);

    const orderCount = orders?.length || 0;
    const totalSpent = orders?.reduce((sum, order) => sum + ((order.total_cents || 0) / 100), 0) || 0;
    const currency = orders?.[0]?.currency || user.currency || 'eur';

    // Get conversation count
    const { count: conversationCount, error: conversationError } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get wishlist count
    const { count: wishlistCount, error: wishlistError } = await supabase
      .from('wishlists')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get review count
    const { count: reviewCount, error: reviewError } = await supabase
      .from('product_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    return NextResponse.json({
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
        locale: user.locale,
        currency: user.currency,
        phone: user.phone,
        email_verified: user.email_verified,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
      },
      stats: {
        orderCount,
        totalSpent,
        currency,
        conversationCount: conversationCount || 0,
        wishlistCount: wishlistCount || 0,
        reviewCount: reviewCount || 0,
      },
    });
  } catch (error) {
    console.error('Error in customer profile API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
