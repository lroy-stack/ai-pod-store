import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'

export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications
 * Returns notifications for the authenticated user, sorted by newest first
 * Query params:
 * - page: page number (default: 1)
 * - limit: items per page (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Parse pagination parameters
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const offset = (page - 1) * limit

    // Fetch total count
    const { count, error: countError } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (countError) {
      console.error('Error counting notifications:', countError)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    // Fetch notifications with pagination
    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching notifications:', error)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    })
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error)
    console.error('Unexpected error in /api/notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
