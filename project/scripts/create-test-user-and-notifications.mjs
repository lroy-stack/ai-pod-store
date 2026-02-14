#!/usr/bin/env node
/**
 * Create a test user and notifications for feature 203 testing
 * Usage: node scripts/create-test-user-and-notifications.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config({ path: resolve(__dirname, '../frontend/.env.local') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function main() {
  console.log('Creating test user and notifications...')

  // Create test user using Supabase Auth Admin API
  const testEmail = 'testuser@example.com'
  const testPassword = 'testpass123456'

  // Check if user already exists
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()

  if (listError) {
    console.error('Error listing users:', listError)
    process.exit(1)
  }

  let userId
  const existingUser = existingUsers.users.find(u => u.email === testEmail)

  if (existingUser) {
    console.log('Test user already exists:', existingUser.id)
    userId = existingUser.id

    // Ensure user exists in public.users
    const { data: publicUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (checkError || !publicUser) {
      console.log('User not in public.users, creating entry...')
      const { error: insertError } = await supabase.from('users').insert({
        id: userId,
        email: testEmail,
        name: 'Test User',
        locale: 'en',
        currency: 'EUR',
        email_verified: true,
      })
      if (insertError) {
        console.error('Error inserting user into public.users:', insertError)
      } else {
        console.log('Created entry in public.users')
      }
    }
  } else {
    // Create new user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Test User',
      },
    })

    if (createError) {
      console.error('Error creating user:', createError)
      process.exit(1)
    }

    userId = newUser.user.id
    console.log('Created test user:', userId)

    // Insert into public.users table
    const { data: userData, error: insertError } = await supabase.from('users').upsert({
      id: userId,
      email: testEmail,
      name: 'Test User',
      locale: 'en',
      currency: 'EUR',
      email_verified: true,
    }, {
      onConflict: 'id'
    }).select()

    if (insertError) {
      console.error('Error inserting into users table:', insertError)
      // Try insert instead of upsert
      const { error: insertError2 } = await supabase.from('users').insert({
        id: userId,
        email: testEmail,
        name: 'Test User',
        locale: 'en',
        currency: 'EUR',
        email_verified: true,
      })
      if (insertError2) {
        console.error('Error with insert:', insertError2)
      } else {
        console.log('Inserted user into public.users table (via insert)')
      }
    } else {
      console.log('Inserted user into public.users table:', userData)
    }
  }

  // Create test notifications
  const notifications = [
    {
      user_id: userId,
      type: 'order_shipped',
      title: 'Order #12345 Shipped',
      body: 'Your order has been shipped and is on its way!',
      is_read: false,
    },
    {
      user_id: userId,
      type: 'payment_success',
      title: 'Payment Received',
      body: 'We have received your payment for order #12346.',
      is_read: false,
    },
    {
      user_id: userId,
      type: 'order_delivered',
      title: 'Order Delivered',
      body: 'Your order #12344 has been delivered to your address.',
      is_read: false,
    },
    {
      user_id: userId,
      type: 'info',
      title: 'New Products Added',
      body: 'Check out our new collection of t-shirts and phone cases!',
      is_read: false,
    },
    {
      user_id: userId,
      type: 'payment_failed',
      title: 'Payment Failed',
      body: 'We could not process your payment. Please update your payment method.',
      is_read: false,
    },
  ]

  // Delete existing test notifications for this user
  const { error: deleteError } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)

  if (deleteError) {
    console.error('Error deleting old notifications:', deleteError)
  } else {
    console.log('Deleted old test notifications')
  }

  // Insert new notifications
  const { data, error } = await supabase.from('notifications').insert(notifications).select()

  if (error) {
    console.error('Error creating notifications:', error)
    process.exit(1)
  }

  console.log(`Created ${data.length} test notifications`)
  console.log('\nTest user credentials:')
  console.log('Email:', testEmail)
  console.log('Password:', testPassword)
  console.log('\nYou can now log in and test the notification features!')
}

main().catch(console.error)
