#!/usr/bin/env node
/**
 * ⚠️  DEPRECATED - SECURITY RISK
 *
 * This script uses a hardcoded password and should NOT be used in production.
 * For secure admin creation, use: node scripts/create-secure-admin.mjs
 *
 * This file is kept for backward compatibility in development/testing only.
 */

console.error('╔════════════════════════════════════════════════════════════╗')
console.error('║  ⚠️  WARNING: This script uses a HARDCODED password!      ║')
console.error('║                                                            ║')
console.error('║  For production use: node scripts/create-secure-admin.mjs ║')
console.error('║                                                            ║')
console.error('║  This script is DEPRECATED and will be removed.           ║')
console.error('╚════════════════════════════════════════════════════════════╝')
console.error('')

process.exit(1)

// DEPRECATED CODE (commented out for security):
// import { createClient } from '@supabase/supabase-js'
// import { config } from 'dotenv'
// import { resolve, dirname } from 'path'
// import { fileURLToPath } from 'url'
//
// const __filename = fileURLToPath(import.meta.url)
// const __dirname = dirname(__filename)
//
// // Load environment variables
// config({ path: resolve(__dirname, '../admin/.env.local') })
//
// const supabaseUrl = process.env.SUPABASE_URL
// const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
//
// if (!supabaseUrl || !supabaseServiceKey) {
//   console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
//   process.exit(1)
// }
//
// const supabase = createClient(supabaseUrl, supabaseServiceKey, {
//   auth: {
//     autoRefreshToken: false,
//     persistSession: false,
//   },
// })
//
// async function main() {
//   console.log('Creating admin user...')
//
//   const adminEmail = 'admin@podai.com'
//   const passwordHash = '$2b$10$LYEFHEv5llNIlHRfUfIY8.A8Zh8TW3tGxDJUQPKb4YTICa3BSgKQW' // SECURITY: Hardcoded admin123
//
//   const { data, error } = await supabase
//     .from('users')
//     .upsert({
//       email: adminEmail,
//       password_hash: passwordHash,
//       name: 'Admin User',
//       role: 'admin',
//       locale: 'en',
//       currency: 'USD',
//       email_verified: true,
//     }, {
//       onConflict: 'email'
//     })
//     .select()
//
//   if (error) {
//     console.error('Error creating admin user:', error)
//     process.exit(1)
//   }
//
//   console.log('Admin user created successfully!')
//   console.log('Email: admin@podai.com')
//   console.log('Password: admin123')  // SECURITY RISK
// }
//
// main().catch(console.error)
