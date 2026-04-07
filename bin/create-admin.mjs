#!/usr/bin/env node
/**
 * Admin User Creation Script
 *
 * Creates an admin user in your Supabase database.
 * Uses bcrypt hashing — no plaintext passwords stored.
 *
 * REQUIRED environment variables (in .env or frontend/.env.local):
 *   SUPABASE_URL        — Your Supabase project URL
 *   SUPABASE_SERVICE_KEY — Service role key (bypasses RLS)
 *
 * Usage:
 *   node bin/create-admin.mjs
 *
 * You will be prompted for:
 *   - Admin email address
 *   - Password (typed interactively, not echoed)
 */

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import readline from 'readline'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load env from root .env first, then frontend/.env.local
config({ path: resolve(__dirname, '../.env') })
config({ path: resolve(__dirname, '../frontend/.env.local'), override: false })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('\n❌ Missing required environment variables:')
  console.error('   SUPABASE_URL         (or NEXT_PUBLIC_SUPABASE_URL)')
  console.error('   SUPABASE_SERVICE_KEY\n')
  console.error('Set them in .env or frontend/.env.local and re-run.\n')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function promptPassword(question) {
  return new Promise((resolve) => {
    process.stdout.write(question)
    const rl = readline.createInterface({ input: process.stdin, output: null })
    let password = ''
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', (char) => {
      const c = char.toString()
      if (c === '\r' || c === '\n') {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdout.write('\n')
        rl.close()
        resolve(password)
      } else if (c === '\u0003') {
        process.exit(0)
      } else if (c === '\u007F') {
        password = password.slice(0, -1)
      } else {
        password += c
        process.stdout.write('*')
      }
    })
  })
}

async function main() {
  console.log('\n🔐 Admin User Creation\n')
  console.log(`   Supabase: ${supabaseUrl}\n`)

  const email = await prompt('Admin email: ')
  if (!email || !email.includes('@')) {
    console.error('❌ Invalid email address')
    process.exit(1)
  }

  const password = await promptPassword('Admin password (min 12 chars): ')
  if (password.length < 12) {
    console.error('❌ Password must be at least 12 characters')
    process.exit(1)
  }

  const confirm = await promptPassword('Confirm password: ')
  if (password !== confirm) {
    console.error('❌ Passwords do not match')
    process.exit(1)
  }

  const name = await prompt('Display name (optional): ') || 'Admin'

  console.log('\nCreating admin user...')

  // Check if user already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .single()

  if (existing) {
    console.error(`\n❌ User with email ${email} already exists.`)
    console.error('   Use the admin panel to change their password if needed.\n')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const { data, error } = await supabase
    .from('users')
    .insert({
      email,
      name,
      password_hash: passwordHash,
      role: 'admin',
      must_change_password: false,
    })
    .select('id, email, role')
    .single()

  if (error) {
    console.error('\n❌ Failed to create admin user:')
    console.error(`   ${error.message}\n`)
    process.exit(1)
  }

  console.log('\n✅ Admin user created successfully!')
  console.log(`   ID:    ${data.id}`)
  console.log(`   Email: ${data.email}`)
  console.log(`   Role:  ${data.role}`)
  console.log('\n⚠️  Store your credentials securely. This is the only time they appear.\n')
}

main().catch((err) => {
  console.error('\n❌ Unexpected error:', err.message)
  process.exit(1)
})
