import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withAuth } from '@/lib/auth-middleware'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// GET /api/messaging/config - Fetch current messaging configuration
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { data, error } = await supabase
      .from('messaging_channels')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Parse config into separate telegram and whatsapp objects
    const telegram = data?.find(ch => ch.platform === 'telegram')
    const whatsapp = data?.find(ch => ch.platform === 'whatsapp')

    return NextResponse.json({
      success: true,
      telegram: telegram ? {
        id: telegram.id,
        enabled: telegram.is_active,
        ...telegram.config
      } : null,
      whatsapp: whatsapp ? {
        id: whatsapp.id,
        enabled: whatsapp.is_active,
        ...whatsapp.config
      } : null
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Failed to process request'
    }, { status: 500 })
  }
})

// POST /api/messaging/config - Save messaging configuration
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { telegram, whatsapp } = body

    const results = []

    // Handle Telegram config
    if (telegram) {
      const { enabled, ...config } = telegram

      // Check if Telegram channel exists
      const { data: existing } = await supabase
        .from('messaging_channels')
        .select('id')
        .eq('platform', 'telegram')
        .single()

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('messaging_channels')
          .update({
            is_active: enabled,
            config,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)

        if (error) throw error
        results.push({ platform: 'telegram', action: 'updated' })
      } else {
        // Create new
        const { error } = await supabase
          .from('messaging_channels')
          .insert({
            platform: 'telegram',
            is_active: enabled,
            config
          })

        if (error) throw error
        results.push({ platform: 'telegram', action: 'created' })
      }
    }

    // Handle WhatsApp config
    if (whatsapp) {
      const { enabled, ...config } = whatsapp

      const { data: existing } = await supabase
        .from('messaging_channels')
        .select('id')
        .eq('platform', 'whatsapp')
        .single()

      if (existing) {
        const { error } = await supabase
          .from('messaging_channels')
          .update({
            is_active: enabled,
            config,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)

        if (error) throw error
        results.push({ platform: 'whatsapp', action: 'updated' })
      } else {
        const { error } = await supabase
          .from('messaging_channels')
          .insert({
            platform: 'whatsapp',
            is_active: enabled,
            config
          })

        if (error) throw error
        results.push({ platform: 'whatsapp', action: 'created' })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Messaging configuration saved',
      results
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Failed to process request'
    }, { status: 500 })
  }
})
