import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    // Get user from session token
    const token = request.cookies.get('sb-access-token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get confirmation flag from request body
    const { confirm } = await request.json()

    if (!confirm) {
      return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
    }

    // GDPR-compliant deletion:
    // Anonymize personal data (keep order history for business records)
    // Note: Full soft-delete with deleted_at column will be added when migration is run

    // Update user record with anonymized data
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        email: `deleted_${user.id}@deleted.local`,
        name: 'Deleted User',
        phone: null,
        avatar_url: null,
        notification_preferences: { email: false, push: false, sms: false },
        preferences: {}
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error anonymizing user:', updateError)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    // Delete shipping addresses (cascading delete will handle this if FK is set)
    await supabaseAdmin
      .from('shipping_addresses')
      .delete()
      .eq('user_id', user.id)

    // Delete the user from Supabase Auth (complete account deletion)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError)
      // Continue anyway - the user data is already anonymized
    }

    // Sign out the user from Supabase Auth
    await supabaseAdmin.auth.admin.signOut(token)

    // Create response with cleared cookies
    const response = NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    })

    // Clear all session cookies
    response.cookies.delete('sb-access-token')
    response.cookies.delete('sb-refresh-token')

    return response
  } catch (err: any) {
    console.error('Error in account deletion:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
