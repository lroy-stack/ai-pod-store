import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { supabaseAdmin } from '@/lib/supabase';

interface IntegrityCheck {
  name: string;
  description: string;
  count: number;
  severity: 'critical' | 'warning' | 'info';
  viewPath: string;
}

/**
 * GET /api/monitoring/integrity
 * Returns data integrity check results
 */
export const GET = withAuth(async () => {
  try {
    const checks: IntegrityCheck[] = [];

    // 1. Products without images
    const { count: noImages } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .is('images', null)
      .eq('status', 'active');

    checks.push({
      name: 'Products Without Images',
      description: 'Active products with no image data',
      count: noImages || 0,
      severity: noImages && noImages > 0 ? 'warning' : 'info',
      viewPath: '/products?filter=no_images',
    });

    // 2. Products without provider
    const { count: noProvider } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .is('pod_provider', null)
      .eq('status', 'active');

    checks.push({
      name: 'Products Without Provider',
      description: 'Active products not connected to any POD provider',
      count: noProvider || 0,
      severity: noProvider && noProvider > 5 ? 'critical' : noProvider && noProvider > 0 ? 'warning' : 'info',
      viewPath: '/products?filter=no_provider',
    });

    // 3. Orphaned designs (designs without product link)
    const { count: orphanedDesigns } = await supabaseAdmin
      .from('designs')
      .select('*', { count: 'exact', head: true })
      .is('product_id', null);

    checks.push({
      name: 'Orphaned Designs',
      description: 'Designs not linked to any product',
      count: orphanedDesigns || 0,
      severity: orphanedDesigns && orphanedDesigns > 20 ? 'warning' : 'info',
      viewPath: '/designs?filter=orphaned',
    });

    // 4. Orders without items
    const { data: ordersData } = await supabaseAdmin
      .from('orders')
      .select('id')
      .limit(500);

    let ordersWithoutItems = 0;
    if (ordersData && ordersData.length > 0) {
      const orderIds = ordersData.map((o) => o.id);
      const { data: orderItems } = await supabaseAdmin
        .from('order_items')
        .select('order_id')
        .in('order_id', orderIds);
      const orderIdsWithItems = new Set((orderItems || []).map((i) => i.order_id));
      ordersWithoutItems = orderIds.filter((id) => !orderIdsWithItems.has(id)).length;
    }

    checks.push({
      name: 'Orders Without Items',
      description: 'Orders that have no line items',
      count: ordersWithoutItems,
      severity: ordersWithoutItems > 0 ? 'critical' : 'info',
      viewPath: '/orders?filter=no_items',
    });

    // 5. Variants without price
    const { count: noPriceVariants } = await supabaseAdmin
      .from('product_variants')
      .select('*', { count: 'exact', head: true })
      .or('price_cents.is.null,price_cents.eq.0')
      .eq('is_enabled', true);

    checks.push({
      name: 'Variants Without Price',
      description: 'Enabled variants with null or zero price',
      count: noPriceVariants || 0,
      severity: noPriceVariants && noPriceVariants > 0 ? 'critical' : 'info',
      viewPath: '/products?filter=no_price',
    });

    const overallSeverity = checks.some((c) => c.severity === 'critical' && c.count > 0)
      ? 'critical'
      : checks.some((c) => c.severity === 'warning' && c.count > 0)
      ? 'warning'
      : 'info';

    return NextResponse.json({
      checks,
      overallSeverity,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
});
