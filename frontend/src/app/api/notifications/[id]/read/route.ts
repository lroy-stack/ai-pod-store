import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'

export const dynamic = 'force-dynamic'

/**
 * Shared handler for marking a notification as read
 */
async function markAsRead(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const user = await requireAuth(request)

    // Mark notification as read (user_id check prevents IDOR)
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error marking notification as read:', error)
      return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    return NextResponse.json({ notification: data })
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error)
    console.error('Unexpected error in marking notification as read:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/notifications/[id]/read
 * Marks a notification as read
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return markAsRead(request, context)
}

/**
 * PUT /api/notifications/[id]/read
 * Marks a notification as read (alias for PATCH)
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return markAsRead(request, context)
}
