import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async (req, session) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get('period') || '7d'; // 7d, 30d, or 90d

    // Calculate date range
    const daysMap: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };
    const days = daysMap[period] || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch orders grouped by date
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('created_at, total_cents, currency')
      .gte('created_at', startDate.toISOString())
      .in('status', ['completed', 'paid', 'processing', 'shipped', 'delivered'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Revenue trend error:', error);
      return NextResponse.json({ error: 'Failed to fetch revenue trend' }, { status: 500 });
    }

    // Group by date and calculate revenue + orders count
    const revenueByDate: Record<string, number> = {};
    const ordersByDate: Record<string, number> = {};
    orders?.forEach((order) => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      const revenueEur = order.total_cents / 100; // Convert cents to euros
      revenueByDate[date] = (revenueByDate[date] || 0) + revenueEur;
      ordersByDate[date] = (ordersByDate[date] || 0) + 1;
    });

    // Fill in missing dates with 0
    const chartData: { date: string; revenue: number; orders: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      chartData.push({
        date: dateStr,
        revenue: revenueByDate[dateStr] || 0,
        orders: ordersByDate[dateStr] || 0,
      });
    }

    return NextResponse.json(chartData);
  } catch (error) {
    console.error('Revenue trend error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
