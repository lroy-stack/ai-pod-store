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
import { BASE_URL, BRAND, EMAIL_FROM } from '@/lib/store-config'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const CRON_SECRET = process.env.CRON_SECRET

// TODO: Use subscriber's locale preference when available in newsletter_subscribers table
const DEFAULT_LOCALE = 'en'

// Simple email templates with unsubscribe links (RFC 8058 + CAN-SPAM compliant)
const TEMPLATES: Record<string, (email: string, unsubscribeUrl: string, locale?: string) => { html: string }> = {
  welcome: (email, unsubscribeUrl) => ({
    html: `
      <h1>Welcome to ${BRAND.name}!</h1>
      <p>Hey there! Thanks for joining ${BRAND.name}, your AI-powered design studio.</p>
      <p>You can now:</p>
      <ul>
        <li>Chat with our AI assistant to find the perfect product</li>
        <li>Generate up to 5 custom designs per month</li>
        <li>Preview mockups on real products</li>
      </ul>
      <p><a href="${BASE_URL}">Start Designing →</a></p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999; text-align: center;">
        You received this email because you signed up for ${BRAND.name} Store.<br>
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Unsubscribe from marketing emails</a>
      </p>
    `,
  }),
  tips: (email, unsubscribeUrl) => ({
    html: `
      <h1>3 Ways to Create Amazing Designs</h1>
      <p>Here are some tips to get the most out of ${BRAND.name}:</p>
      <ol>
        <li><strong>Be specific</strong> — "A watercolor sunset over mountains" works better than "sunset"</li>
        <li><strong>Try different styles</strong> — Ask for "minimalist", "cartoon", or "realistic"</li>
        <li><strong>Preview on products</strong> — Generate mockups to see how your design looks on a t-shirt</li>
      </ol>
      <p><a href="${BASE_URL}">Try It Now →</a></p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999; text-align: center;">
        You received this email because you signed up for ${BRAND.name} Store.<br>
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Unsubscribe from marketing emails</a>
      </p>
    `,
  }),
  credit_offer: (email, unsubscribeUrl, locale) => ({
    html: `
      <h1>Unlock More Designs with Premium</h1>
      <p>Want to create more? Upgrade to Premium for 50 designs/month, 100 mockups/month, and bonus credits.</p>
      <p>Premium subscribers also get overflow credits for extra designs when they need them.</p>
      <p><a href="${BASE_URL}/${locale || DEFAULT_LOCALE}/pricing">See Premium Plans →</a></p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999; text-align: center;">
        You received this email because you signed up for ${BRAND.name} Store.<br>
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

        // GDPR compliance: Only send to confirmed newsletter subscribers
        const { data: subscriber } = await supabase
          .from('newsletter_subscribers')
          .select('confirmed_at')
          .eq('email', item.email)
          .single()

        if (!subscriber || !subscriber.confirmed_at) {
          console.warn(`[Drip] Skipping unconfirmed subscriber: ${item.email}`)
          await supabase.from('drip_queue').update({ status: 'skipped' }).eq('id', item.id)
          failed++
          continue
        }

        // Check user notification preferences (if user account exists)
        const { data: userPrefs } = await supabase
          .from('users')
          .select('notification_preferences')
          .eq('email', item.email)
          .single()

        if (userPrefs?.notification_preferences?.marketing_emails === false) {
          console.info(`[Drip] Skipping — marketing_emails disabled for: ${item.email}`)
          await supabase.from('drip_queue').update({ status: 'skipped' }).eq('id', item.id)
          failed++
          continue
        }

        // Generate one-click unsubscribe token (RFC 8058)
        const unsubscribeToken = generateUnsubscribeToken(item.email)
        const unsubscribeUrl = `${BASE_URL}/api/newsletter/unsubscribe?token=${unsubscribeToken}`

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
              from: EMAIL_FROM,
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
