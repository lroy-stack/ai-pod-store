/**
 * Admin Subscribers API
 *
 * GET /api/admin/subscribers
 * Returns paginated list of users with active or past_due subscriptions
 */

import { createClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

async function handler(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = request.nextUrl

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10)
    const per_page = parseInt(searchParams.get('per_page') || '20', 10)
    const offset = (page - 1) * per_page

    // Validate pagination
    if (page < 1 || per_page < 1 || per_page > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    // Fetch subscribers (active or past_due)
    const { data: subscribers, error, count } = await supabase
      .from('users')
      .select('id, email, name, tier, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_period_end, created_at', { count: 'exact' })
      .in('subscription_status', ['active', 'past_due'])
      .order('created_at', { ascending: false })
      .range(offset, offset + per_page - 1)

    if (error) {
      console.error('Error fetching subscribers:', error)
      return NextResponse.json(
        { error: 'Failed to fetch subscribers' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      subscribers: subscribers || [],
      pagination: {
        page,
        per_page,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / per_page),
      },
    })
  } catch (error) {
    console.error('Error in subscribers API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(handler)
