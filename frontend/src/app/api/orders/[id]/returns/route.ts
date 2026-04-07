import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireAuth, authErrorResponse } from '@/lib/auth-guard';

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

// Validation schema for return request
const returnRequestSchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let user;
    try {
      user = await requireAuth(req);
    } catch (error) {
      return authErrorResponse(error);
    }

    const { id: orderId } = await params;

    // Parse and validate request body
    const body = await req.json();
    const validation = returnRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { reason } = validation.data;

    // Check if order exists and get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, total_cents, currency, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Ownership check: user can only create returns for their own orders (admins can for any)
    if (order.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if order status is eligible for return
    if (!['paid', 'submitted', 'in_production', 'shipped', 'delivered'].includes(order.status)) {
      return NextResponse.json(
        { error: 'Order is not eligible for return. Status must be paid, submitted, in_production, shipped, or delivered.' },
        { status: 400 }
      );
    }

    // Check if a return request already exists for this order
    // Only block if status is pending, approved, processing, or completed
    // Allow new requests if previous was rejected
    const { data: existingReturn } = await supabase
      .from('return_requests')
      .select('id, status')
      .eq('order_id', orderId)
      .in('status', ['pending', 'approved', 'processing', 'completed'])
      .single();

    if (existingReturn) {
      return NextResponse.json(
        { error: `A return request already exists for this order (status: ${existingReturn.status})` },
        { status: 409 }
      );
    }

    // Create return request
    const { data: returnRequest, error: returnError } = await supabase
      .from('return_requests')
      .insert({
        order_id: orderId,
        user_id: user.id,
        reason,
        refund_amount_cents: order.total_cents,
        refund_currency: order.currency,
        status: 'pending',
      })
      .select()
      .single();

    if (returnError) {
      console.error('Return request creation error:', returnError);
      return NextResponse.json(
        { error: 'Failed to create return request', details: returnError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        return_request: returnRequest,
        message: 'Return request submitted successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Return request API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch return requests for an order
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let user;
    try {
      user = await requireAuth(req);
    } catch (error) {
      return authErrorResponse(error);
    }

    const { id: orderId } = await params;

    // Verify order exists and user owns it
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Ownership check: user can only view returns for their own orders (admins can for any)
    if (order.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Fetch all return requests for this order
    const { data: returnRequests, error } = await supabase
      .from('return_requests')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Return request fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch return requests' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      return_requests: returnRequests || [],
    });
  } catch (error) {
    console.error('Return request API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
