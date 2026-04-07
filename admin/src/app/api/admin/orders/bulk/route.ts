import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withPermission } from '@/lib/rbac';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export const POST = withPermission('orders', 'update', async (req, session) => {
  try {
    const body = await req.json();
    const { orderIds, action } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid order IDs' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Map actions to order statuses
    let newStatus: string;
    switch (action) {
      case 'cancel':
        newStatus = 'cancelled';
        break;
      case 'mark_shipped':
        newStatus = 'shipped';
        break;
      case 'mark_delivered':
        newStatus = 'delivered';
        break;
      case 'mark_processing':
        newStatus = 'processing';
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // State transition validation — only allow valid transitions
    const VALID_TRANSITIONS: Record<string, string[]> = {
      pending: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: ['completed'],
      completed: [],
      cancelled: [],
      refunded: [],
    };

    // Pre-fetch current order statuses to validate transitions
    const { data: currentOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id, status')
      .in('id', orderIds);

    if (fetchError || !currentOrders) {
      console.error('Bulk fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    // Separate valid and invalid transitions
    const validIds: string[] = [];
    const invalidTransitions: Array<{ id: string; current: string; target: string }> = [];

    for (const order of currentOrders) {
      const allowed = VALID_TRANSITIONS[order.status] || [];
      if (allowed.includes(newStatus)) {
        validIds.push(order.id);
      } else {
        invalidTransitions.push({ id: order.id, current: order.status, target: newStatus });
      }
    }

    if (validIds.length === 0) {
      return NextResponse.json({
        error: 'No orders can transition to the requested status',
        invalidTransitions,
      }, { status: 400 });
    }

    // Update only orders with valid transitions
    const { data, error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .in('id', validIds)
      .select();

    if (error) {
      console.error('Bulk update error:', error);
      return NextResponse.json(
        { error: 'Failed to update orders' },
        { status: 500 }
      );
    }

    // Log the bulk action in audit log (with actual old statuses)
    const statusMap = new Map(currentOrders.map(o => [o.id, o.status]));
    const auditEntries = validIds.map((orderId) => ({
      entity_type: 'order',
      entity_id: orderId,
      action: 'update',
      changes: {
        status: { old: statusMap.get(orderId) || 'unknown', new: newStatus },
        bulk_action: action,
      },
      user_id: session.userId,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    }));

    await supabase.from('audit_log').insert(auditEntries.map(e => ({
      actor_type: 'admin' as const,
      actor_id: e.user_id,
      action: `bulk_${action}`,
      resource_type: e.entity_type,
      resource_id: e.entity_id,
      changes: e.changes,
      metadata: { ip_address: e.ip_address, user_agent: e.user_agent },
    })));

    return NextResponse.json({
      success: true,
      updatedCount: data?.length || 0,
      orders: data,
      ...(invalidTransitions.length > 0 && {
        skipped: invalidTransitions.length,
        invalidTransitions,
      }),
    });
  } catch (error) {
    console.error('Bulk action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
})
