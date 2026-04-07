import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth-middleware';
import type { SessionData } from '@/lib/session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export const GET = withAuth(async (request: NextRequest, session: SessionData) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch order items and aggregate by product
    const { data: orderItems, error } = await supabase
      .from('order_items')
      .select(`
        product_id,
        quantity,
        products (
          title,
          images
        )
      `)
      .limit(1000);

    if (error) {
      console.error('Top products error:', error);
      return NextResponse.json({ error: 'Failed to fetch top products' }, { status: 500 });
    }

    // Aggregate quantities by product
    const productQuantities: Record<string, { name: string; quantity: number }> = {};

    orderItems?.forEach((item: any) => {
      const productId = item.product_id;
      const productName = item.products?.title || 'Unknown Product';

      if (!productQuantities[productId]) {
        productQuantities[productId] = {
          name: productName,
          quantity: 0,
        };
      }
      productQuantities[productId].quantity += item.quantity;
    });

    // Convert to array and sort by quantity
    const topProducts = Object.values(productQuantities)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5) // Top 5 products
      .map(p => ({
        name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
        sales: p.quantity,
      }));

    return NextResponse.json(topProducts);
  } catch (error) {
    console.error('Top products error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
