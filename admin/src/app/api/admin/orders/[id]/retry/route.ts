import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-admin';
import { withPermission, AdminSession } from '@/lib/rbac';

async function handler(
  request: NextRequest,
  _session: AdminSession,
  context?: { params?: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context!.params!;

    // Get Supabase admin client
    const supabase = createClient();

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if the order has a failed provider status
    if (order.provider_status !== 'failed' && order.pod_error === null) {
      return NextResponse.json(
        { error: 'Order does not have a failed provider status' },
        { status: 400 }
      );
    }

    // Fetch order items with provider-agnostic columns
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*, product:products(provider_product_id), variant:product_variants(external_variant_id)')
      .eq('order_id', orderId);

    if (itemsError || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items found for this order' },
        { status: 400 }
      );
    }

    // Use the frontend API to resubmit the order via the provider abstraction layer
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL!;
    const cronSecret = process.env.CRON_SECRET || process.env.PODCLAW_BRIDGE_AUTH_TOKEN;

    const retryResponse = await fetch(
      `${frontendUrl}/api/cron/retry-pod-orders`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
        },
      }
    );

    if (!retryResponse.ok) {
      throw new Error('Failed to trigger order retry via cron');
    }

    const retryResult = await retryResponse.json();

    // Create audit log entry
    await supabase.from('audit_log').insert({
      action: 'order.provider.retry',
      resource_type: 'order',
      resource_id: orderId,
      details: {
        previous_status: order.provider_status || 'failed',
        triggered_by: 'admin_manual_retry',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Order retry triggered via provider',
      result: retryResult,
    });
  } catch (error: any) {
    console.error('Provider retry error:', error);
    return NextResponse.json(
      { error: 'Failed to retry provider submission' },
      { status: 500 }
    );
  }
}

export const POST = withPermission('orders', 'update', handler);
