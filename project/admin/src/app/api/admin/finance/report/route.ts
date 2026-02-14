import { createClient } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createClient();

    // Get all completed orders with items
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_cents, currency, created_at, status')
      .in('status', ['paid', 'processing', 'shipped', 'delivered'])
      .order('created_at', { ascending: true });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    // Get order items with product info
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('order_id, product_id, quantity, unit_price_cents, products(title, category)')
      .order('product_id');

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch order items' }, { status: 500 });
    }

    // Calculate total revenue
    const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_cents || 0), 0) || 0;

    // Calculate revenue by product
    const productRevenue = new Map<string, { name: string; category: string; revenue: number; quantity: number }>();

    orderItems?.forEach(item => {
      const productId = item.product_id;
      const productName = item.products?.title || 'Unknown Product';
      const productCategory = item.products?.category || 'uncategorized';
      const revenue = (item.unit_price_cents || 0) * (item.quantity || 0);
      const quantity = item.quantity || 0;

      const existing = productRevenue.get(productId);
      if (existing) {
        existing.revenue += revenue;
        existing.quantity += quantity;
      } else {
        productRevenue.set(productId, {
          name: productName,
          category: productCategory,
          revenue,
          quantity,
        });
      }
    });

    // Convert to array and sort by revenue
    const productMargins = Array.from(productRevenue.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        category: data.category,
        revenue: data.revenue / 100, // Convert cents to decimal
        quantity: data.quantity,
        // Simplified margin calculation (would need COGS data for accurate margin)
        // For POD, typical margin is ~30-40% after Printify costs
        estimatedMargin: (data.revenue * 0.35) / 100,
        marginPercent: 35,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Calculate revenue by month (last 12 months)
    const monthlyRevenue: { month: string; revenue: number; orders: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      const monthOrders = orders?.filter(order => {
        const orderMonth = order.created_at?.slice(0, 7);
        return orderMonth === monthKey;
      }) || [];

      const monthRevenue = monthOrders.reduce((sum, order) => sum + (order.total_cents || 0), 0);

      monthlyRevenue.push({
        month: monthLabel,
        revenue: monthRevenue / 100,
        orders: monthOrders.length,
      });
    }

    // Calculate P&L statement
    const totalCosts = totalRevenue * 0.65; // Simplified: assume 65% costs (Printify, Stripe, ops)
    const grossProfit = totalRevenue - totalCosts;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const report = {
      summary: {
        totalRevenue: totalRevenue / 100,
        totalOrders: orders?.length || 0,
        averageOrderValue: orders?.length ? (totalRevenue / orders.length) / 100 : 0,
        currency: orders?.[0]?.currency || 'eur',
      },
      profitAndLoss: {
        revenue: totalRevenue / 100,
        costs: totalCosts / 100,
        grossProfit: grossProfit / 100,
        grossMarginPercent: Math.round(grossMargin * 10) / 10,
        // Simplified breakdown
        breakdown: {
          printifyCosts: (totalRevenue * 0.45) / 100,
          stripeFees: (totalRevenue * 0.03) / 100,
          operationalCosts: (totalRevenue * 0.17) / 100,
        },
      },
      productMargins,
      monthlyRevenue,
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error in finance report API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
