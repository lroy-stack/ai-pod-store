import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'

export const dynamic = 'force-dynamic'

/**
 * Shared handler for marking all notifications as read
 */
async function markAllAsRead(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .select()

    if (error) {
      console.error('Error marking all notifications as read:', error)
      return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'All notifications marked as read',
      count: data?.length || 0
    })
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error)
    console.error('Unexpected error in marking all notifications as read:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/notifications/read-all
 * Marks all notifications as read for the authenticated user
 */
export async function PATCH(request: NextRequest) {
  return markAllAsRead(request)
}

/**
 * PUT /api/notifications/read-all
 * Marks all notifications as read (alias for PATCH)
 */
export async function PUT(request: NextRequest) {
  return markAllAsRead(request)
}
