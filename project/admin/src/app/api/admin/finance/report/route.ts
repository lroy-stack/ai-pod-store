import { createClient } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';

// Stripe fee formula: 2.9% + EUR 0.25 per transaction
const STRIPE_RATE = 0.029;
const STRIPE_FIXED_CENTS = 25; // EUR 0.25

export const GET = withAuth(async (req, session) => {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(req.url);
    const paymentMethod = searchParams.get('paymentMethod');

    // Get all completed orders
    let query = supabase
      .from('orders')
      .select('id, total_cents, currency, created_at, status, payment_method')
      .in('status', ['paid', 'processing', 'shipped', 'delivered']);

    // Apply payment method filter if provided
    if (paymentMethod && paymentMethod !== 'all') {
      query = query.eq('payment_method', paymentMethod);
    }

    const { data: orders, error: ordersError } = await query.order('created_at', { ascending: true });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    const orderIds = orders?.map(o => o.id) || [];

    // Calculate total revenue
    const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_cents || 0), 0) || 0;

    // Calculate Stripe fees: 2.9% + EUR 0.25 per order
    const totalStripeFees = orders?.reduce((sum, order) => {
      const fee = Math.round((order.total_cents || 0) * STRIPE_RATE) + STRIPE_FIXED_CENTS;
      return sum + fee;
    }, 0) || 0;

    // Get order items with real Printful base costs from product_variants
    let orderItems: any[] = [];
    if (orderIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select(
          'order_id, product_id, variant_id, quantity, unit_price_cents, cost_cents, products(title), product_variants(cost_cents)'
        )
        .in('order_id', orderIds);

      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
        return NextResponse.json({ error: 'Failed to fetch order items' }, { status: 500 });
      }
      orderItems = items || [];
    }

    // Aggregate per-product margins using real Printful base costs
    let totalPrintfulCosts = 0;
    const productRevenue = new Map<
      string,
      { name: string; revenue: number; quantity: number; printfulCost: number }
    >();

    orderItems.forEach(item => {
      const productId = item.product_id as string;
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      const productName = (product?.title as string) || 'Unknown Product';
      const quantity = (item.quantity as number) || 0;
      const revenue = ((item.unit_price_cents as number) || 0) * quantity;

      // Use order_items.cost_cents if set, otherwise fall back to product_variants.cost_cents
      const variant = Array.isArray(item.product_variants)
        ? item.product_variants[0]
        : item.product_variants;
      const unitCost =
        (item.cost_cents as number | null) ?? (variant?.cost_cents as number | null) ?? 0;
      const printfulCost = unitCost * quantity;

      totalPrintfulCosts += printfulCost;

      const existing = productRevenue.get(productId);
      if (existing) {
        existing.revenue += revenue;
        existing.quantity += quantity;
        existing.printfulCost += printfulCost;
      } else {
        productRevenue.set(productId, { name: productName, revenue, quantity, printfulCost });
      }
    });

    // Build per-product margin rows (Stripe fee allocated proportionally by revenue share)
    const productMargins = Array.from(productRevenue.entries())
      .map(([productId, data]) => {
        const revenueDecimal = data.revenue / 100;
        const printfulCostDecimal = data.printfulCost / 100;
        const stripeFeeDecimal =
          totalRevenue > 0
            ? (data.revenue / totalRevenue) * (totalStripeFees / 100)
            : 0;
        const grossProfit = revenueDecimal - printfulCostDecimal - stripeFeeDecimal;
        const marginPercent =
          revenueDecimal > 0 ? Math.round((grossProfit / revenueDecimal) * 1000) / 10 : 0;
        return {
          productId,
          productName: data.name,
          category: 'product',
          revenue: revenueDecimal,
          quantity: data.quantity,
          printfulCost: Math.round(printfulCostDecimal * 100) / 100,
          stripeFee: Math.round(stripeFeeDecimal * 100) / 100,
          estimatedMargin: Math.round(grossProfit * 100) / 100,
          marginPercent,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // Calculate revenue by month (last 12 months)
    const monthlyRevenue: { month: string; revenue: number; orders: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      const monthOrders =
        orders?.filter(order => {
          const orderMonth = order.created_at?.slice(0, 7);
          return orderMonth === monthKey;
        }) || [];

      const monthRev = monthOrders.reduce((sum, order) => sum + (order.total_cents || 0), 0);

      monthlyRevenue.push({
        month: monthLabel,
        revenue: monthRev / 100,
        orders: monthOrders.length,
      });
    }

    // Overall category breakdown (one row since we removed legacy category field)
    const totalGrossProfit =
      productMargins.reduce((sum, p) => sum + p.estimatedMargin, 0);
    const overallMarginPercent =
      totalRevenue > 0
        ? Math.round((totalGrossProfit / (totalRevenue / 100)) * 1000) / 10
        : 0;
    const categoryMarginBreakdown = [
      {
        category: 'all products',
        revenue: totalRevenue / 100,
        quantity: productMargins.reduce((sum, p) => sum + p.quantity, 0),
        estimatedMargin: totalGrossProfit,
        marginPercent: overallMarginPercent,
      },
    ];

    // P&L using real Printful base costs + Stripe fees (no hardcoded percentages)
    const totalCosts = totalPrintfulCosts + totalStripeFees;
    const grossProfit = totalRevenue - totalCosts;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const report = {
      summary: {
        totalRevenue: totalRevenue / 100,
        totalOrders: orders?.length || 0,
        averageOrderValue: orders?.length ? totalRevenue / orders.length / 100 : 0,
        currency: orders?.[0]?.currency || 'eur',
      },
      profitAndLoss: {
        revenue: totalRevenue / 100,
        costs: totalCosts / 100,
        grossProfit: grossProfit / 100,
        grossMarginPercent: Math.round(grossMargin * 10) / 10,
        breakdown: {
          printfulCosts: totalPrintfulCosts / 100,
          stripeFees: totalStripeFees / 100,
          operationalCosts: 0,
        },
      },
      productMargins,
      categoryMarginBreakdown,
      monthlyRevenue,
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error in finance report API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
