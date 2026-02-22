/**
 * GET /api/cron/drip
 *
 * Cron-triggered email drip processor.
 * Reads pending emails from drip_queue where send_at <= now, sends via Resend.
 *
 * Should be called every 15-30 minutes via Vercel Cron or external cron.
 * Protected by Bearer token authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateUnsubscribeToken } from '@/lib/unsubscribe-token'
import { verifyCronSecret } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const CRON_SECRET = process.env.CRON_SECRET || process.env.PODCLAW_BRIDGE_AUTH_TOKEN

// Simple email templates with unsubscribe links (RFC 8058 + CAN-SPAM compliant)
const TEMPLATES: Record<string, (email: string, unsubscribeUrl: string) => { html: string }> = {
  welcome: (email, unsubscribeUrl) => ({
    html: `
      <h1>Welcome to POD AI!</h1>
      <p>Hey there! Thanks for joining POD AI, your AI-powered design studio.</p>
      <p>You can now:</p>
      <ul>
        <li>Chat with our AI assistant to find the perfect product</li>
        <li>Generate up to 3 custom designs per day</li>
        <li>Preview mockups on real products</li>
      </ul>
      <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://podai.com'}">Start Designing →</a></p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999; text-align: center;">
        You received this email because you signed up for POD AI Store.<br>
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Unsubscribe from marketing emails</a>
      </p>
    `,
  }),
  tips: (email, unsubscribeUrl) => ({
    html: `
      <h1>3 Ways to Create Amazing Designs</h1>
      <p>Here are some tips to get the most out of POD AI:</p>
      <ol>
        <li><strong>Be specific</strong> — "A watercolor sunset over mountains" works better than "sunset"</li>
        <li><strong>Try different styles</strong> — Ask for "minimalist", "cartoon", or "realistic"</li>
        <li><strong>Preview on products</strong> — Generate mockups to see how your design looks on a t-shirt</li>
      </ol>
      <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://podai.com'}">Try It Now →</a></p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999; text-align: center;">
        You received this email because you signed up for POD AI Store.<br>
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Unsubscribe from marketing emails</a>
      </p>
    `,
  }),
  credit_offer: (email, unsubscribeUrl) => ({
    html: `
      <h1>Your 5 Free Design Credits</h1>
      <p>Did you know? You received 5 free design credits when you signed up!</p>
      <p>Each credit lets you generate one custom AI design. Use them to create unique products.</p>
      <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://podai.com'}">Use Your Credits →</a></p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999; text-align: center;">
        You received this email because you signed up for POD AI Store.<br>
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Unsubscribe from marketing emails</a>
      </p>
    `,
  }),
}

export async function GET(req: NextRequest) {
  // Verify cron secret (timing-safe)
  const authHeader = req.headers.get('authorization')
  if (!verifyCronSecret(authHeader, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date().toISOString()

    // Fetch pending emails where send_at has passed
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('drip_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('send_at', now)
      .order('send_at', { ascending: true })
      .limit(20) // Process up to 20 per run

    if (fetchError) {
      console.error('[Drip] Fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 })
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    let sent = 0
    let failed = 0

    for (const item of pendingEmails) {
      try {
        const templateFn = TEMPLATES[item.template]
        if (!templateFn) {
          console.warn(`[Drip] Unknown template: ${item.template}`)
          await supabase.from('drip_queue').update({ status: 'failed' }).eq('id', item.id)
          failed++
          continue
        }

        // Generate one-click unsubscribe token (RFC 8058)
        const unsubscribeToken = generateUnsubscribeToken(item.email)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const unsubscribeUrl = `${baseUrl}/api/newsletter/unsubscribe?token=${unsubscribeToken}`

        const { html } = templateFn(item.email, unsubscribeUrl)

        // Send via Resend
        const resendKey = process.env.RESEND_API_KEY
        if (resendKey) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM_EMAIL || 'POD AI <noreply@podai.com>',
              to: item.email,
              subject: item.subject,
              html,
              headers: {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }),
          })

          if (!res.ok) {
            console.error(`[Drip] Resend error for ${item.id}:`, await res.text())
            await supabase.from('drip_queue').update({ status: 'failed' }).eq('id', item.id)
            failed++
            continue
          }
        }

        // Mark as sent
        await supabase.from('drip_queue').update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        }).eq('id', item.id)

        sent++
      } catch (err) {
        console.error(`[Drip] Error processing ${item.id}:`, err)
        await supabase.from('drip_queue').update({ status: 'failed' }).eq('id', item.id)
        failed++
      }
    }

    return NextResponse.json({ processed: pendingEmails.length, sent, failed })
  } catch (error) {
    console.error('[Drip] Cron error:', error)
    return NextResponse.json({ error: 'Drip processing failed' }, { status: 500 })
  }
}
