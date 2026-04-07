import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch (error) {
    return authErrorResponse(error)
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status'); // Filter by status
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    // Note: Using !return_requests_user_id_fkey and !return_requests_approved_by_fkey
    // to disambiguate multiple FK relationships to users table
    let query = supabase
      .from('return_requests')
      .select(`
        *,
        order:orders(
          id,
          total_cents,
          currency,
          status,
          created_at
        ),
        user:users!return_requests_user_id_fkey(
          id,
          email,
          name
        ),
        approver:users!return_requests_approved_by_fkey(
          id,
          email,
          name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data: returnRequests, error, count } = await query;

    if (error) {
      console.error('Failed to fetch return requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch return requests' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      return_requests: returnRequests || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Return requests list API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
