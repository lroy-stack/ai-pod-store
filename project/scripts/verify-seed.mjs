#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '../frontend/.env.local') })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('Verifying seed data...\n')

// Check products
const { data: products, count: productCount } = await supabase
  .from('products')
  .select('id, title, base_price_cents', { count: 'exact' })
  .limit(10)

console.log(`Products: ${productCount} total`)
products?.forEach(p => console.log(`  - ${p.title} ($${(p.base_price_cents / 100).toFixed(2)})`))

// Check users
const { data: users, count: userCount } = await supabase
  .from('users')
  .select('email, role', { count: 'exact' })

console.log(`\nUsers: ${userCount} total`)
users?.forEach(u => console.log(`  - ${u.email} (${u.role})`))

console.log('\n✓ Verification complete')
