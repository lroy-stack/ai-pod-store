#!/usr/bin/env node
/**
 * Secure Admin User Creation Script
 *
 * Creates an admin user with a randomly generated secure password.
 * NEVER uses hardcoded passwords.
 *
 * Usage:
 *   node scripts/create-secure-admin.mjs [email]
 *
 * Example:
 *   node scripts/create-secure-admin.mjs admin@example.com
 */

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from frontend .env.local
config({ path: resolve(__dirname, '../frontend/.env.local') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in frontend/.env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

/**
 * Generate a cryptographically secure random password
 * Format: 4 words from a memorable word list + 4 random digits
 * Example: "correct-horse-battery-staple-8472"
 */
function generateSecurePassword() {
  // Simple memorable word list (expand in production)
  const words = [
    'forest', 'mountain', 'river', 'ocean', 'valley', 'cloud', 'storm', 'sunrise',
    'meadow', 'canyon', 'glacier', 'desert', 'island', 'plateau', 'coast', 'fjord',
    'harbor', 'lagoon', 'marsh', 'prairie', 'reef', 'ridge', 'summit', 'tundra',
    'volcano', 'waterfall', 'woodland', 'archipelago', 'basin', 'delta', 'estuary'
  ]

  // Select 4 random words
  const selectedWords = []
  for (let i = 0; i < 4; i++) {
    const randomIndex = crypto.randomInt(0, words.length)
    selectedWords.push(words[randomIndex])
  }

  // Add 4 random digits
  const randomDigits = crypto.randomInt(1000, 9999)

  return `${selectedWords.join('-')}-${randomDigits}`
}

async function createSecureAdmin(email) {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    console.error('❌ Invalid email format:', email)
    process.exit(1)
  }

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', email)
    .single()

  if (existingUser) {
    console.log('⚠️  User already exists:', existingUser.email)
    console.log('   Role:', existingUser.role)
    console.log('   To update password, delete the user first or use a different email.')
    return
  }

  // Generate secure random password
  const password = generateSecurePassword()
  const passwordHash = await bcrypt.hash(password, 12) // Use cost factor 12 for extra security

  console.log('🔐 Creating admin user with secure random password...')

  // Create admin user
  const { data, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: passwordHash,
      name: 'Administrator',
      role: 'admin',
      locale: 'en',
      currency: 'EUR',
      email_verified: true,
      must_change_password: false, // Secure random password doesn't need forced change
    })
    .select()
    .single()

  if (error) {
    console.error('❌ Error creating admin user:', error.message)
    process.exit(1)
  }

  console.log('\n✅ Admin user created successfully!')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║                    ADMIN CREDENTIALS                       ║')
  console.log('╠════════════════════════════════════════════════════════════╣')
  console.log(`║ Email:    ${email.padEnd(48)} ║`)
  console.log(`║ Password: ${password.padEnd(48)} ║`)
  console.log('╠════════════════════════════════════════════════════════════╣')
  console.log('║ ⚠️  IMPORTANT: Save these credentials securely!            ║')
  console.log('║ This password will NOT be shown again.                    ║')
  console.log('║ Access admin panel at: http://localhost:3001              ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log()
}

// Get email from command line argument or use default
const email = process.argv[2] || 'admin@podstore.local'

createSecureAdmin(email).catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
