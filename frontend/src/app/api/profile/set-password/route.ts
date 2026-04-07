/**
 * POST /api/profile/set-password
 *
 * Set a password for OAuth-only users (Google/Apple sign-in without email identity).
 * This allows them to also log in with email + password.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, getAccessToken, authErrorResponse } from '@/lib/auth-guard'
import { changePasswordLimiter } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    // Rate limit
    const rl = changePasswordLimiter.check(`set-password:${user.id}`)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
    }

    const body = await req.json()
    const { newPassword } = body

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Verify user does NOT already have an email identity
    const token = getAccessToken(req)
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(token)
    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const hasEmailIdentity = authUser.identities?.some(i => i.provider === 'email')
    if (hasEmailIdentity) {
      return NextResponse.json(
        { error: 'You already have a password. Use the change password form instead.' },
        { status: 409 }
      )
    }

    // Set password via admin API (creates email identity)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('[set-password] Error:', updateError)
      return NextResponse.json({ error: 'Failed to set password' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Password set successfully. You can now log in with email and password.',
    })
  } catch (error) {
    const resp = authErrorResponse(error)
    if (resp) return resp
    console.error('[set-password] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
