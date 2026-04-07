/**
 * POST /api/referral
 *
 * Register a referral and award credits when a referred user verifies email.
 * Body: { referrerCode: string } — the referrer's user ID (used as code)
 *
 * Awards 3 credits to referrer and 3 to referred when referred user is verified.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const REFERRAL_CREDITS = 3

export async function POST(req: NextRequest) {
  try {
    let user
    try {
      user = await requireAuth(req)
    } catch (error) {
      return authErrorResponse(error)
    }

    const { referrerCode } = await req.json()

    if (!referrerCode) {
      return NextResponse.json({ error: 'referrerCode required' }, { status: 400 })
    }

    // Cannot refer yourself
    if (referrerCode === user.id) {
      return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 })
    }

    // Check if referrer exists
    const { data: referrer } = await supabase
      .from('users')
      .select('id')
      .eq('id', referrerCode)
      .single()

    if (!referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 })
    }

    // Check if referral already exists
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Referral already registered' }, { status: 409 })
    }

    // Create referral record
    const { error: insertError } = await supabase.from('referrals').insert({
      referrer_id: referrer.id,
      referred_id: user.id,
      credits_awarded: true,
    })

    if (insertError) {
      console.error('[Referral] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to register referral' }, { status: 500 })
    }

    // Award credits to referrer (atomic)
    const { data: referrerResult } = await supabase.rpc('add_credits', {
      p_user_id: referrer.id,
      p_amount: REFERRAL_CREDITS,
    })
    await supabase.from('credit_transactions').insert({
      user_id: referrer.id,
      amount: REFERRAL_CREDITS,
      reason: 'referral_bonus',
      balance_after: referrerResult?.balance ?? 0,
    })

    // Award credits to referred user (atomic)
    const { data: referredResult } = await supabase.rpc('add_credits', {
      p_user_id: user.id,
      p_amount: REFERRAL_CREDITS,
    })
    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      amount: REFERRAL_CREDITS,
      reason: 'referral_welcome',
      balance_after: referredResult?.balance ?? 0,
    })

    return NextResponse.json({
      success: true,
      creditsAwarded: REFERRAL_CREDITS,
      message: `You received ${REFERRAL_CREDITS} free design credits!`,
    })
  } catch (error) {
    console.error('[Referral] Error:', error)
    return NextResponse.json({ error: 'Failed to process referral' }, { status: 500 })
  }
}
