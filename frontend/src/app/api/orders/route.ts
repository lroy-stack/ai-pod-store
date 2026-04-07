/**
 * Orders API
 *
 * GET /api/orders
 * Retrieves the authenticated user's order history
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    let user
    try {
      user = await requireAuth(req)
    } catch (error) {
      return authErrorResponse(error)
    }

    // Parse pagination parameters
    const searchParams = req.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100) // Max 100 per page
    const status = searchParams.get('status') // Optional status filter

    // Calculate offset for pagination
    const offset = (page - 1) * limit

    // Multi-tenant isolation: filter by tenant_id when x-tenant-id header is set
    const tenantId = req.headers.get('x-tenant-id') || null

    // Build query with pagination
    let query = supabase
      .from('orders')
      .select('id, status, total_cents, currency, created_at, paid_at, shipped_at, tracking_number, customer_email', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply tenant isolation when header is present
    if (tenantId) {
      query = query.eq('tenant_id', tenantId)
    }

    // Apply status filter if provided
    if (status) {
      // Support comma-separated statuses (e.g., "pending,processing")
      const statuses = status.split(',').map(s => s.trim())
      query = query.in('status', statuses)
    }

    const { data: orders, error, count } = await query

    if (error) {
      console.error('Error fetching orders:', error)
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      )
    }

    // Calculate pagination metadata
    const total = count || 0
    const totalPages = Math.ceil(total / limit)

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
    })
  } catch (error) {
    console.error('Orders API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
