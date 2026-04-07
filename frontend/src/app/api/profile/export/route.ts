import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { fetchLegalSettings, resolvePlaceholders } from '@/lib/legal-utils'
import { BRAND } from '@/lib/store-config'
import JSZip from 'jszip'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Rate limiting: Check last export timestamp (stored in user preferences)
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('preferences')
      .eq('id', user.id)
      .single()

    const lastExport = userData?.preferences?.last_data_export
    if (lastExport) {
      const hoursSinceLastExport = (Date.now() - new Date(lastExport).getTime()) / (1000 * 60 * 60)
      if (hoursSinceLastExport < 24) {
        const hoursRemaining = Math.ceil(24 - hoursSinceLastExport)
        return NextResponse.json(
          { error: `Rate limited. Please wait ${hoursRemaining} hours before requesting another export.` },
          { status: 429 }
        )
      }
    }

    // Gather user data from all tables
    const [
      profile,
      orders,
      conversations,
      designs,
      wishlists,
      personalizations,
      notifications,
      shippingAddresses,
      creditTransactions,
    ] = await Promise.all([
      // Profile
      supabaseAdmin.from('users').select('*').eq('id', user.id).single(),

      // Orders
      supabaseAdmin.from('orders').select('*').eq('user_id', user.id),

      // Conversations and messages
      supabaseAdmin
        .from('conversations')
        .select('*, messages(*)')
        .eq('user_id', user.id),

      // Designs (if user has created any)
      supabaseAdmin.from('user_designs').select('*').eq('user_id', user.id),

      // Wishlists
      supabaseAdmin.from('wishlists').select('*').eq('user_id', user.id),

      // Personalizations
      supabaseAdmin.from('personalizations').select('*').eq('user_id', user.id),

      // Notifications
      supabaseAdmin.from('notifications').select('*').eq('user_id', user.id),

      // Shipping addresses
      supabaseAdmin.from('shipping_addresses').select('*').eq('user_id', user.id),

      // Credit transactions
      supabaseAdmin.from('credit_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])

    // Fetch legal settings for dynamic company info
    const legalSettings = await fetchLegalSettings()

    // Create ZIP file
    const zip = new JSZip()

    // Add JSON files to ZIP
    zip.file('profile.json', JSON.stringify(profile.data || {}, null, 2))
    zip.file('orders.json', JSON.stringify(orders.data || [], null, 2))
    zip.file('conversations.json', JSON.stringify(conversations.data || [], null, 2))
    zip.file('designs.json', JSON.stringify(designs.data || [], null, 2))
    zip.file('wishlists.json', JSON.stringify(wishlists.data || [], null, 2))
    zip.file('personalizations.json', JSON.stringify(personalizations.data || [], null, 2))
    zip.file('notifications.json', JSON.stringify(notifications.data || [], null, 2))
    zip.file('shipping_addresses.json', JSON.stringify(shippingAddresses.data || [], null, 2))
    zip.file('credit_transactions.json', JSON.stringify(creditTransactions.data || [], null, 2))

    // Add README with dynamic company info
    const readmeTemplate = `# Your {{company_name}} Data Export
Generated: ${new Date().toISOString()}
User ID: ${user.id}

## Contents

- profile.json: Your account profile information
- orders.json: Your order history
- conversations.json: Your chat conversations with PodClaw
- designs.json: Your custom designs
- wishlists.json: Your saved wishlists
- personalizations.json: Product personalization data
- notifications.json: Your notification history
- shipping_addresses.json: Your saved shipping addresses

## GDPR Compliance

This export is provided in compliance with GDPR Article 20 (Right to Data Portability).
All data is provided in JSON format for easy import into other systems.

If you have questions about your data, please contact: {{company_email}}
`

    // Resolve placeholders with actual legal settings
    const readme = resolvePlaceholders(readmeTemplate, legalSettings)

    zip.file('README.txt', readme)

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    // Update last export timestamp
    await supabaseAdmin
      .from('users')
      .update({
        preferences: {
          ...userData?.preferences,
          last_data_export: new Date().toISOString(),
        },
      })
      .eq('id', user.id)

    // Return ZIP file
    const response = new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${BRAND.name.toLowerCase()}-data-export-${user.id.slice(0, 8)}-${Date.now()}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })

    return response
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error)
    console.error('Error in data export:', error)
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}
