/**
 * Handlers for Stripe subscription webhook events
 *
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 */

import Stripe from 'stripe'
import { triggerDripSequence } from '@/lib/email-drip'
import { supabase } from './shared'

/**
 * Handle subscription created/updated
 * Updates user tier and subscription info
 */
export async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  try {
    // Find user by Stripe customer ID
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, credit_balance')
      .eq('stripe_customer_id', customerId)
      .single()

    if (userError || !user) {
      console.error('Subscription update: user not found for customer', customerId)
      return
    }

    const isActive = subscription.status === 'active'
    const periodEnd = (subscription as any).current_period_end
      ? new Date((subscription as any).current_period_end * 1000).toISOString()
      : null

    // Update user tier and subscription info
    const { error: updateError } = await supabase
      .from('users')
      .update({
        tier: isActive ? 'premium' : 'free',
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status === 'active' ? 'active'
          : subscription.status === 'past_due' ? 'past_due'
          : 'none',
        subscription_period_end: periodEnd,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to update user subscription:', updateError)
      return
    }

    // Add monthly bonus credits on new subscription activation (atomic + idempotent)
    if (isActive) {
      const bonusCredits = 10

      // Idempotency guard: check if bonus was already credited for this subscription
      const { data: existingBonus } = await supabase
        .from('credit_transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('stripe_payment_id', subscription.id)
        .eq('reason', 'subscription_bonus')
        .maybeSingle()

      if (existingBonus) {
        console.log(`Subscription bonus already credited for user ${user.id}, skipping (idempotent)`)
      } else {
        const { data: bonusResult } = await supabase.rpc('add_credits', {
          p_user_id: user.id,
          p_amount: bonusCredits,
        })

        const newBalance = bonusResult?.balance ?? 0

        await supabase.from('credit_transactions').insert({
          user_id: user.id,
          amount: bonusCredits,
          reason: 'subscription_bonus',
          balance_after: newBalance,
          stripe_payment_id: subscription.id,
        })

        console.log(`Added ${bonusCredits} bonus credits for user ${user.id}`)
      }
    }

    // Trigger welcome drip sequence for new subscribers
    if (isActive) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('email')
        .eq('id', user.id)
        .single()

      if (userProfile?.email) {
        triggerDripSequence(user.id, userProfile.email, 'welcome').catch((err) =>
          console.error('Failed to trigger drip sequence:', err)
        )
      }
    }

    console.log(`Updated subscription for user ${user.id}: tier=${isActive ? 'premium' : 'free'}`)
  } catch (error) {
    console.error('Error handling subscription update:', error)
  }
}

/**
 * Handle subscription deleted/cancelled
 */
export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

    const { error } = await supabase
      .from('users')
      .update({
        tier: 'free',
        subscription_status: 'cancelled',
      })
      .eq('stripe_customer_id', customerId)

    if (error) {
      console.error('Failed to handle subscription deletion:', error)
    } else {
      console.log('Subscription cancelled for customer:', customerId)
    }
  } catch (error) {
    console.error('Error handling subscription deletion:', error)
  }
}
