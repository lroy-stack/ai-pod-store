/**
 * POST /api/profile/cancel-deletion
 * Cancel a pending account deletion (within 30-day grace period).
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    // Check that deletion is actually pending
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('deletion_requested_at')
      .eq('id', user.id)
      .single()

    if (!profile?.deletion_requested_at) {
      return NextResponse.json({ error: 'No pending deletion' }, { status: 400 })
    }

    // Cancel deletion
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        deletion_requested_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[cancel-deletion] Error:', updateError)
      return NextResponse.json({ error: 'Failed to cancel deletion' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error)
    console.error('[cancel-deletion] Error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
