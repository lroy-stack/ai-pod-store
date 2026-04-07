/**
 * POST /api/orders/[id]/refund — Issue partial or full refund via Stripe
 * Body: { amount_cents?: number, reason?: string }
 * If amount_cents is omitted, full refund is issued.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/rbac';
import { supabaseAdmin } from '@/lib/supabase';
import { logUpdate } from '@/lib/audit';
import Stripe from 'stripe';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover' as Stripe.LatestApiVersion,
  });
}

export const POST = withPermission('orders', 'refund', async (
  req: NextRequest,
  session,
  context?: { params: Promise<{ id: string }> }
) => {
  const { id } = await context!.params;

  try {
    const body = await req.json();
    const { amount_cents, reason } = body;

    // Get order with payment intent
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, status, total_cents, stripe_payment_intent_id')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!order.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'No payment intent found for this order' }, { status: 400 });
    }

    if (order.status === 'refunded') {
      return NextResponse.json({ error: 'Order already refunded' }, { status: 409 });
    }

    const refundAmount = amount_cents || order.total_cents;
    const isPartial = amount_cents && amount_cents < order.total_cents;

    // Create Stripe refund
    const refund = await getStripe().refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      amount: refundAmount,
      reason: 'requested_by_customer',
    }, {
      idempotencyKey: `refund-${id}-${refundAmount}`,
    });

    // Update order status
    const newStatus = isPartial ? order.status : 'refunded';
    const updateData: Record<string, unknown> = {
      refund_amount_cents: refundAmount,
      stripe_refund_id: refund.id,
    };
    if (!isPartial) {
      updateData.status = 'refunded';
    }

    await supabaseAdmin.from('orders').update(updateData).eq('id', id);

    await logUpdate(session.email, 'order', id,
      { status: order.status },
      { status: newStatus, refund_amount_cents: refundAmount, reason }
    );

    return NextResponse.json({
      refund_id: refund.id,
      amount_cents: refundAmount,
      is_partial: isPartial,
      status: newStatus,
    });
  } catch (error) {
    console.error('Refund error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Refund failed' },
      { status: 500 }
    );
  }
});
