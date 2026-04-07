import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, getAccessToken, authErrorResponse } from '@/lib/auth-guard'
import { Resend } from 'resend'
import { EMAIL_FROM, BRAND } from '@/lib/store-config'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

/**
 * POST /api/profile/delete
 * GDPR-compliant account deletion with 30-day grace period
 *
 * Implements soft delete:
 * 1. Marks account with deletion_requested_at timestamp
 * 2. Sends confirmation email to user
 * 3. After 30 days, cron job will hard-delete the account
 *
 * User can cancel deletion within 30 days by logging in again
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Get confirmation flag from request body
    const { confirm } = await request.json()

    if (!confirm) {
      return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
    }

    // Get user details for email
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('email, name, locale')
      .eq('id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // SOFT DELETE: Mark account for deletion (30-day grace period)
    const now = new Date().toISOString()
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        deletion_requested_at: now,
        updated_at: now
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error marking user for deletion:', updateError)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    // Send confirmation email
    if (resend && userData.email) {
      const deletionDate = new Date()
      deletionDate.setDate(deletionDate.getDate() + 30)
      const formattedDate = deletionDate.toLocaleDateString(userData.locale || 'en', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: userData.email,
          subject: 'Account Deletion Confirmation - 30 Day Grace Period',
          html: `
            <h2>Account Deletion Requested</h2>
            <p>Hi ${userData.name || 'there'},</p>
            <p>We've received your request to delete your account. Your account is now scheduled for permanent deletion.</p>

            <h3>30-Day Grace Period</h3>
            <p>Your account will be <strong>permanently deleted on ${formattedDate}</strong>.</p>

            <h3>Changed Your Mind?</h3>
            <p>If you log in before this date, your account deletion will be automatically cancelled and your account will remain active.</p>

            <h3>What Happens Next</h3>
            <ul>
              <li>For the next 30 days, your account remains accessible by logging in</li>
              <li>Logging in will cancel the deletion request</li>
              <li>After 30 days, your account and all associated data will be permanently deleted</li>
              <li>This includes: personal information, order history, saved addresses, and preferences</li>
            </ul>

            <p>If you did not request this deletion, please log in immediately to cancel it.</p>

            <p>Best regards,<br>${BRAND.name}</p>
          `
        })
      } catch (emailError) {
        console.error('Error sending deletion confirmation email:', emailError)
        // Continue - deletion is already marked, email is best-effort
      }
    }

    // Sign out the user from current session
    const token = getAccessToken(request)
    if (token) await supabaseAdmin.auth.admin.signOut(token)

    // Create response with cleared cookies
    const response = NextResponse.json({
      success: true,
      message: 'Account deletion requested. You have 30 days to cancel by logging in again.',
      deletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })

    // Clear all session cookies
    response.cookies.delete('sb-access-token')
    response.cookies.delete('sb-refresh-token')

    return response
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error)
    console.error('Error in account deletion:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
