import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyCronSecret } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * GET /api/cron/hard-delete-accounts
 * Hard-delete accounts that passed the 30-day grace period
 *
 * Finds accounts where deletion_requested_at is more than 30 days ago,
 * then permanently deletes all user data and the account itself.
 *
 * Intended to be called daily by Vercel Cron or external scheduler.
 * Protected by Bearer token authentication.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret (timing-safe)
  const authHeader = req.headers.get('authorization')
  if (!verifyCronSecret(authHeader, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, any> = {
    accountsDeleted: 0,
    errors: []
  }

  try {
    // Find accounts where deletion was requested more than 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: accountsToDelete } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .not('deletion_requested_at', 'is', null)
      .lt('deletion_requested_at', thirtyDaysAgo.toISOString())
      .limit(100) // Process in batches to avoid timeouts

    if (!accountsToDelete || accountsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        results: {
          accountsDeleted: 0,
          message: 'No accounts pending hard deletion'
        }
      })
    }

    // Hard-delete each account
    for (const account of accountsToDelete) {
      try {
        // Delete user-specific data (GDPR right to be forgotten)
        const deletions = [
          // Personal data
          supabaseAdmin.from('shipping_addresses').delete().eq('user_id', account.id),
          supabaseAdmin.from('personalizations').delete().eq('user_id', account.id),
          supabaseAdmin.from('wishlists').delete().eq('user_id', account.id),
          supabaseAdmin.from('notifications').delete().eq('user_id', account.id),
          supabaseAdmin.from('user_consents').delete().eq('user_id', account.id),

          // Conversations and messages
          supabaseAdmin.from('messages').delete().eq('user_id', account.id),
          supabaseAdmin.from('conversations').delete().eq('user_id', account.id),
        ]

        // Execute all deletions in parallel
        await Promise.allSettled(deletions)

        // Anonymize orders (keep for business records but remove PII)
        await supabaseAdmin
          .from('orders')
          .update({
            customer_name: 'Deleted User',
            customer_email: null,
            shipping_address: null,
          })
          .eq('user_id', account.id)

        // Delete cart items
        await supabaseAdmin
          .from('cart_items')
          .delete()
          .eq('user_id', account.id)

        // Delete the user record from users table
        await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', account.id)

        // Delete the user from Supabase Auth
        await supabaseAdmin.auth.admin.deleteUser(account.id)

        results.accountsDeleted++
      } catch (error) {
        console.error(`Error deleting account ${account.id}:`, error)
        results.errors.push({
          userId: account.id,
          email: account.email,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('Hard delete cron error:', error)
    return NextResponse.json(
      {
        error: 'Hard delete failed',
        details: error instanceof Error ? error.message : String(error),
        results
      },
      { status: 500 }
    )
  }
}
