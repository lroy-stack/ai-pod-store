import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { z } from 'zod';
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Validation schema for approval/rejection
const approvalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  admin_notes: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin(req)
  } catch (error) {
    return authErrorResponse(error)
  }

  try {
    const { id: returnRequestId } = await params;

    // Parse and validate request body
    const body = await req.json();
    const validation = approvalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { action, admin_notes } = validation.data;

    // Fetch the return request
    const { data: returnRequest, error: returnError } = await supabase
      .from('return_requests')
      .select(`
        id,
        order_id,
        user_id,
        reason,
        status,
        refund_amount_cents,
        refund_currency,
        stripe_refund_id
      `)
      .eq('id', returnRequestId)
      .single();

    if (returnError || !returnRequest) {
      return NextResponse.json(
        { error: 'Return request not found' },
        { status: 404 }
      );
    }

    // Check if already processed
    if (returnRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Return request already ${returnRequest.status}` },
        { status: 409 }
      );
    }

    if (action === 'reject') {
      // Just update status to rejected
      const { data: updated, error: updateError } = await supabase
        .from('return_requests')
        .update({
          status: 'rejected',
          admin_notes,
          approved_by: admin.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', returnRequestId)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to reject return request:', updateError);
        return NextResponse.json(
          { error: 'Failed to reject return request' },
          { status: 500 }
        );
      }

      // Log audit trail
      await supabase.from('audit_log').insert({
        actor_type: 'admin',
        actor_id: admin.id,
        action: 'return_request.reject',
        resource_type: 'return_request',
        resource_id: returnRequestId,
        changes: {
          before: { status: 'pending' },
          after: { status: 'rejected' },
        },
        metadata: { admin_notes },
      });

      return NextResponse.json({
        success: true,
        return_request: updated,
        message: 'Return request rejected',
      });
    }

    // APPROVE: Process refund via Stripe
    // Fetch the order to get payment intent ID
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, stripe_payment_intent_id, total_cents, currency, status')
      .eq('id', returnRequest.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (!order.stripe_payment_intent_id) {
      return NextResponse.json(
        { error: 'Order has no payment intent (guest checkout or missing data)' },
        { status: 400 }
      );
    }

    // Update return request to processing
    await supabase
      .from('return_requests')
      .update({
        status: 'processing',
        approved_by: admin.id,
        approved_at: new Date().toISOString(),
        admin_notes,
      })
      .eq('id', returnRequestId);

    let stripeRefundId: string | undefined;

    try {
      // Create Stripe refund
      const refund = await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        amount: returnRequest.refund_amount_cents,
        reason: 'requested_by_customer',
        metadata: {
          return_request_id: returnRequestId,
          order_id: order.id,
          admin_id: admin.id,
        },
      });

      stripeRefundId = refund.id;

      // Update return request with Stripe refund ID
      const { data: completedReturn, error: completeError } = await supabase
        .from('return_requests')
        .update({
          status: 'completed',
          stripe_refund_id: refund.id,
          completed_at: new Date().toISOString(),
        })
        .eq('id', returnRequestId)
        .select()
        .single();

      if (completeError) {
        console.error('Failed to mark return as completed:', completeError);
      }

      // Update order status to refunded
      await supabase
        .from('orders')
        .update({ status: 'refunded' })
        .eq('id', order.id);

      // Log audit trail
      await supabase.from('audit_log').insert({
        actor_type: 'admin',
        actor_id: admin.id,
        action: 'return_request.approve',
        resource_type: 'return_request',
        resource_id: returnRequestId,
        changes: {
          before: { status: 'pending' },
          after: { status: 'completed', stripe_refund_id: refund.id },
        },
        metadata: {
          admin_notes,
          refund_amount_cents: returnRequest.refund_amount_cents,
          stripe_refund_id: refund.id,
        },
      });

      // Create notification for user
      if (returnRequest.user_id) {
        await supabase.from('notifications').insert({
          user_id: returnRequest.user_id,
          type: 'refund_processed',
          title: 'Refund Processed',
          body: `Your return request has been approved and refund of ${(returnRequest.refund_amount_cents / 100).toFixed(2)} ${returnRequest.refund_currency.toUpperCase()} has been initiated.`,
          data: {
            return_request_id: returnRequestId,
            order_id: order.id,
            refund_id: refund.id,
          },
        });
      }

      return NextResponse.json({
        success: true,
        return_request: completedReturn,
        refund: {
          id: refund.id,
          amount: refund.amount,
          currency: refund.currency,
          status: refund.status,
        },
        message: 'Return approved and refund processed',
      });
    } catch (stripeError: any) {
      console.error('Stripe refund error:', stripeError);

      // Revert return request to pending on Stripe failure
      await supabase
        .from('return_requests')
        .update({
          status: 'pending',
          admin_notes: `${admin_notes || ''}\n\nRefund failed: ${stripeError.message}`,
        })
        .eq('id', returnRequestId);

      return NextResponse.json(
        {
          error: 'Refund processing failed',
          details: stripeError.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Return approval API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
