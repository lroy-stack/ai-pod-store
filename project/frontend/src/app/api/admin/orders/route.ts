/**
 * Admin Orders API
 *
 * GET /api/admin/orders
 * Returns all orders with pagination and filtering (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function GET(req: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Max 100 per page
    const status = searchParams.get('status'); // Optional status filter
    const search = searchParams.get('search'); // Optional search by email/id

    // Calculate offset
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('orders')
      .select(`
        id,
        user_id,
        stripe_session_id,
        stripe_payment_intent_id,
        printify_order_id,
        status,
        total_cents,
        currency,
        shipping_address,
        customer_email,
        tracking_number,
        tracking_url,
        carrier,
        locale,
        created_at,
        updated_at,
        paid_at,
        shipped_at,
        delivered_at,
        printify_retry_count,
        printify_error,
        user:users(
          id,
          email,
          name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter if provided
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      query = query.in('status', statuses);
    }

    // Apply search filter if provided
    if (search) {
      query = query.or(`customer_email.ilike.%${search}%,id.eq.${search}`);
    }

    const { data: orders, error, count } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    // Calculate pagination metadata
    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      orders: orders || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Admin orders API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
