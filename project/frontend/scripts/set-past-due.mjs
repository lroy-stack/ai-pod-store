#!/usr/bin/env node
/**
 * Test script: Set user subscription_status to 'past_due'
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const email = process.argv[2] || 'e2e-test@example.com'

console.log(`Setting subscription_status to 'past_due' for ${email}...`)

const { data, error } = await supabase
  .from('users')
  .update({ subscription_status: 'past_due' })
  .eq('email', email)
  .select()

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

if (!data || data.length === 0) {
  console.error(`❌ User not found: ${email}`)
  process.exit(1)
}

console.log('✅ Subscription status set to past_due')
console.log('User:', { id: data[0].id, email: data[0].email, subscription_status: data[0].subscription_status })
