import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    // Update orders in bulk
    const { data, error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .in('id', orderIds)
      .select();

    if (error) {
      console.error('Bulk update error:', error);
      return NextResponse.json(
        { error: 'Failed to update orders' },
        { status: 500 }
      );
    }

    // Log the bulk action in audit log
    const auditEntries = orderIds.map((orderId) => ({
      entity_type: 'order',
      entity_id: orderId,
      action: 'update',
      changes: {
        status: { old: null, new: newStatus },
        bulk_action: action,
      },
      user_id: null, // TODO: Add admin user ID when auth is implemented
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    }));

    await supabase.from('audit_log').insert(auditEntries.map(e => ({
      actor_type: 'admin' as const,
      actor_id: e.user_id || 'unknown',
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
    });
  } catch (error) {
    console.error('Bulk action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
