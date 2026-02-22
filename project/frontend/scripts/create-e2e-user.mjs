#!/usr/bin/env node

/**
 * Create E2E Test User
 * Creates a test user with confirmed email for E2E testing
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read .env.local file
const envPath = join(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.+)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = envVars.SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_KEY

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

const testUser = {
  email: 'e2e-test@example.com',
  password: 'testpass123456',
  name: 'E2E Test User',
}

async function createTestUser() {
  console.log('Creating test user:', testUser.email)

  // Create user in Supabase Auth with email confirmed
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: testUser.email,
    password: testUser.password,
    email_confirm: true,
    user_metadata: {
      name: testUser.name,
    },
  })

  if (authError) {
    // User might already exist
    if (authError.message.includes('already exists') || authError.message.includes('duplicate')) {
      console.log('User already exists, fetching existing user...')

      // Get existing user by email
      const { data: users, error: listError } = await supabase.auth.admin.listUsers()
      if (listError) {
        console.error('Failed to list users:', listError)
        process.exit(1)
      }

      const existingUser = users.users.find(u => u.email === testUser.email)
      if (!existingUser) {
        console.error('User exists but could not be found')
        process.exit(1)
      }

      console.log('Found existing user:', existingUser.id)

      // Update password
      const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: testUser.password,
        email_confirm: true,
      })

      if (updateError) {
        console.error('Failed to update password:', updateError)
      } else {
        console.log('Password updated successfully')
      }

      // Ensure profile exists
      await ensureProfile(existingUser.id)

      console.log('Test user ready:', testUser.email)
      return
    }

    console.error('Failed to create user:', authError)
    process.exit(1)
  }

  if (!authData.user) {
    console.error('No user data returned')
    process.exit(1)
  }

  console.log('User created in auth:', authData.user.id)

  // Create profile in users table
  await ensureProfile(authData.user.id)

  console.log('Test user created successfully!')
  console.log('Email:', testUser.email)
  console.log('Password:', testUser.password)
}

async function ensureProfile(userId) {
  const { error: profileError } = await supabase
    .from('users')
    .upsert({
      id: userId,
      email: testUser.email,
      name: testUser.name,
      locale: 'en',
      currency: 'EUR',
      email_verified: true,
      role: 'customer',
      notification_preferences: {
        email: true,
        push: false,
        sms: false,
      },
    }, {
      onConflict: 'id',
    })

  if (profileError) {
    console.error('Failed to create/update profile:', profileError)
  } else {
    console.log('Profile created/updated in users table')
  }
}

createTestUser().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
