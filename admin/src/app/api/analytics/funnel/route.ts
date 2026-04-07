import { withAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const GET = withAuth(async (req, session) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get counts for each funnel stage in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Count view_product events
    const { count: viewProductCount } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'view_product')
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Count add_to_cart events
    const { count: addToCartCount } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'add_to_cart')
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Count begin_checkout events
    const { count: beginCheckoutCount } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'begin_checkout')
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Count purchase events
    const { count: purchaseCount } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'purchase')
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Calculate conversion rates
    const viewToCart = viewProductCount ? (addToCartCount || 0) / viewProductCount * 100 : 0;
    const cartToCheckout = addToCartCount ? (beginCheckoutCount || 0) / addToCartCount * 100 : 0;
    const checkoutToPurchase = beginCheckoutCount ? (purchaseCount || 0) / beginCheckoutCount * 100 : 0;
    const overallConversion = viewProductCount ? (purchaseCount || 0) / viewProductCount * 100 : 0;

    return NextResponse.json({
      funnel: {
        view_product: viewProductCount || 0,
        add_to_cart: addToCartCount || 0,
        begin_checkout: beginCheckoutCount || 0,
        purchase: purchaseCount || 0,
      },
      conversionRates: {
        viewToCart: Number(viewToCart.toFixed(2)),
        cartToCheckout: Number(cartToCheckout.toFixed(2)),
        checkoutToPurchase: Number(checkoutToPurchase.toFixed(2)),
        overall: Number(overallConversion.toFixed(2)),
      },
      period: {
        start: thirtyDaysAgo.toISOString(),
        end: new Date().toISOString(),
        days: 30,
      },
    });
  } catch (error) {
    console.error('Error fetching funnel analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch funnel analytics' },
      { status: 500 }
    );
  }
})
