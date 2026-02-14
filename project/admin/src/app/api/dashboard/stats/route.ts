import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Fetch total revenue (sum of all completed orders)
    const { data: revenueData, error: revenueError } = await supabaseAdmin
      .from('orders')
      .select('total_cents')
      .eq('status', 'completed');

    if (revenueError) {
      console.error('Revenue fetch error:', revenueError);
    }

    const totalRevenue = revenueData?.reduce((sum, order) => sum + (order.total_cents || 0), 0) || 0;

    // Fetch total orders count
    const { count: ordersCount, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (ordersError) {
      console.error('Orders count error:', ordersError);
    }

    // Fetch total products count (active products only)
    const { count: productsCount, error: productsError } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

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

    return NextResponse.json({
      revenue: totalRevenue / 100, // Convert cents to currency
      ordersCount: ordersCount || 0,
      productsCount: productsCount || 0,
      conversionRate: conversionRate.toFixed(1),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
