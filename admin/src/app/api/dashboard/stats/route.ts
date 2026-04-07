import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async () => {
  try {
    // Calculate date ranges for current and previous 30-day periods
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Fetch total revenue (sum of all completed orders)
    const { data: revenueData, error: revenueError } = await supabaseAdmin
      .from('orders')
      .select('total_cents')
      .eq('status', 'completed');

    if (revenueError) {
      console.error('Revenue fetch error:', revenueError);
    }

    const totalRevenue = revenueData?.reduce((sum, order) => sum + (order.total_cents || 0), 0) || 0;

    // Fetch revenue for last 30 days
    const { data: currentRevenueData } = await supabaseAdmin
      .from('orders')
      .select('total_cents')
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const currentRevenue = currentRevenueData?.reduce((sum, order) => sum + (order.total_cents || 0), 0) || 0;

    // Fetch revenue for previous 30 days (30-60 days ago)
    const { data: previousRevenueData } = await supabaseAdmin
      .from('orders')
      .select('total_cents')
      .eq('status', 'completed')
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString());

    const previousRevenue = previousRevenueData?.reduce((sum, order) => sum + (order.total_cents || 0), 0) || 0;
    const revenueTrend = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    // Fetch total orders count
    const { count: ordersCount, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (ordersError) {
      console.error('Orders count error:', ordersError);
    }

    // Fetch orders for last 30 days
    const { count: currentOrdersCount } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Fetch orders for previous 30 days (30-60 days ago)
    const { count: previousOrdersCount } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString());

    const ordersTrend = (previousOrdersCount || 0) > 0
      ? (((currentOrdersCount || 0) - (previousOrdersCount || 0)) / (previousOrdersCount || 0)) * 100
      : 0;

    // Fetch total products count (active products only)
    const { count: productsCount, error: productsError } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'published']);

    if (productsError) {
      console.error('Products count error:', productsError);
    }

    // Calculate conversion rate (orders / sessions)
    // For now, use a simple approximation: completed orders / total orders
    const { count: completedOrders, error: completedError } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    if (completedError) {
      console.error('Completed orders error:', completedError);
    }

    const conversionRate = ordersCount && ordersCount > 0
      ? ((completedOrders || 0) / ordersCount) * 100
      : 0;

    // Conversion rate for current period (last 30 days)
    const { count: currentCompletedOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const currentConversionRate = (currentOrdersCount || 0) > 0
      ? ((currentCompletedOrders || 0) / (currentOrdersCount || 0)) * 100
      : 0;

    // Conversion rate for previous period (30-60 days ago)
    const { count: previousCompletedOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString());

    const previousConversionRate = (previousOrdersCount || 0) > 0
      ? ((previousCompletedOrders || 0) / (previousOrdersCount || 0)) * 100
      : 0;

    const conversionRateTrend = previousConversionRate > 0
      ? ((currentConversionRate - previousConversionRate) / previousConversionRate) * 100
      : 0;

    // Subscription metrics
    // Total active subscribers
    const { count: activeSubscribers, error: subsError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'active');

    if (subsError) {
      console.error('Active subscribers error:', subsError);
    }

    // Monthly Recurring Revenue (MRR)
    // Assuming Premium tier costs €9.99/month
    const PREMIUM_MONTHLY_PRICE = 9.99;
    const mrr = (activeSubscribers || 0) * PREMIUM_MONTHLY_PRICE;

    // Churned subscribers this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: churnedCount, error: churnError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'cancelled')
      .gte('updated_at', startOfMonth.toISOString());

    if (churnError) {
      console.error('Churned subscribers error:', churnError);
    }

    // For products, we'll show a simple growth indicator (products don't change frequently)
    // Compare current count to 7 days ago
    const productsTrend = 0; // Products trend is less meaningful, can be enhanced later

    return NextResponse.json({
      revenue: totalRevenue / 100, // Convert cents to currency
      revenueTrend: revenueTrend,
      ordersCount: ordersCount || 0,
      ordersTrend: ordersTrend,
      productsCount: productsCount || 0,
      productsTrend: productsTrend,
      conversionRate: conversionRate.toFixed(1),
      conversionRateTrend: conversionRateTrend,
      // Subscription metrics
      activeSubscribers: activeSubscribers || 0,
      mrr: mrr,
      churnedThisMonth: churnedCount || 0,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
})
