import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * Shared handler for marking all notifications as read
 */
async function markAllAsRead(request: NextRequest) {
  try {
    // Get user from session token
    const token = request.cookies.get('sb-access-token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Mark all notifications as read
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false) // Only update unread notifications
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
