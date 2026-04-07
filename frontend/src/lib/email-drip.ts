/**
 * Email Drip Sequence System
 *
 * Schedules a series of timed emails for new users.
 * Uses drip_queue table with send_at timestamps.
 * Processed by /api/cron/drip endpoint.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export interface DripStep {
  delay_hours: number
  template: string
  subject: string
}

export const DRIP_SEQUENCES: Record<string, DripStep[]> = {
  welcome: [
    { delay_hours: 1, template: 'welcome', subject: `Welcome to ${process.env.NEXT_PUBLIC_SITE_NAME!} — Your AI Design Studio` },
    { delay_hours: 72, template: 'tips', subject: '3 Ways to Create Amazing Designs with AI' },
    { delay_hours: 168, template: 'credit_offer', subject: 'Unlock More Designs — Upgrade to Premium' },
  ],
}

/**
 * Schedule a drip sequence for a user.
 * Inserts rows into drip_queue with calculated send_at times.
 */
export async function triggerDripSequence(
  userId: string,
  email: string,
  sequence: string
): Promise<void> {
  const steps = DRIP_SEQUENCES[sequence]
  if (!steps) {
    console.warn(`[EmailDrip] Unknown sequence: ${sequence}`)
    return
  }

  // Check if user already has this sequence queued
  const { data: existing } = await supabase
    .from('drip_queue')
    .select('id')
    .eq('user_id', userId)
    .eq('sequence', sequence)
    .limit(1)

  if (existing && existing.length > 0) {
    return // Already queued
  }

  const now = new Date()
  const rows = steps.map((step, index) => {
    const sendAt = new Date(now.getTime() + step.delay_hours * 60 * 60 * 1000)
    return {
      user_id: userId,
      email,
      sequence,
      step: index,
      template: step.template,
      subject: step.subject,
      send_at: sendAt.toISOString(),
      status: 'pending',
    }
  })

  const { error } = await supabase.from('drip_queue').insert(rows)
  if (error) {
    console.error('[EmailDrip] Failed to queue sequence:', error)
  }
}
