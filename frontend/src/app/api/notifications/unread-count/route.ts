import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'

export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications/unread-count
 * Returns the count of unread notifications for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) {
      console.error('Error fetching notification count:', error)
      return NextResponse.json({ error: 'Failed to fetch notification count' }, { status: 500 })
    }

    return NextResponse.json({ count: count ?? 0 })
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error)
    console.error('Unexpected error in notifications/unread-count:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
