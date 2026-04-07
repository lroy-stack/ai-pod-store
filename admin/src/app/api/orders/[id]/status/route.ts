/**
 * PATCH /api/orders/[id]/status — Transition order status with state machine validation
 * Body: { status: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/rbac';
import { supabaseAdmin } from '@/lib/supabase';
import { logUpdate } from '@/lib/audit';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
  refunded: [],
};

export const PATCH = withPermission('orders', 'update', async (
  req: NextRequest,
  session,
  context?: { params: Promise<{ id: string }> }
) => {
  const { id } = await context!.params;

  try {
    const { status: newStatus } = await req.json();

    if (!newStatus) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    // Get current order status
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({
        error: `Invalid transition: ${order.status} → ${newStatus}`,
        allowed_transitions: allowed,
      }, { status: 422 });
    }

    // Update status with timestamp
    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'shipped') updateData.shipped_at = new Date().toISOString();
    if (newStatus === 'delivered') updateData.delivered_at = new Date().toISOString();
    if (newStatus === 'cancelled') updateData.cancelled_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    await logUpdate(session.email, 'order', id, { status: order.status }, { status: newStatus });

    return NextResponse.json({ status: newStatus, previous: order.status });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
});
