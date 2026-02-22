#!/usr/bin/env node
/**
 * Update a test order with payment_method for testing feature 189
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read .env.local from frontend
const envPath = join(__dirname, 'project/frontend/.env.local')
const envContent = readFileSync(envPath, 'utf-8')

const SUPABASE_URL = envContent.match(/^SUPABASE_URL=(.+)$/m)?.[1]
const SUPABASE_SERVICE_KEY = envContent.match(/^SUPABASE_SERVICE_KEY=(.+)$/m)?.[1]

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// 1. Get the most recent order
console.log('🔍 Finding recent orders...\n')
const { data: orders, error: fetchError } = await supabase
  .from('orders')
  .select('id, status, customer_email, payment_method, created_at')
  .order('created_at', { ascending: false })
  .limit(3)

if (fetchError) {
  console.error('❌ Error fetching orders:', fetchError)
  process.exit(1)
}

if (!orders || orders.length === 0) {
  console.log('⚠️  No orders found in database')
  process.exit(0)
}

console.log(`Found ${orders.length} recent orders:\n`)
orders.forEach((order, index) => {
  console.log(`${index + 1}. ID: ${order.id.substring(0, 8)}...`)
  console.log(`   Email: ${order.customer_email || 'N/A'}`)
  console.log(`   Status: ${order.status}`)
  console.log(`   Payment Method: ${order.payment_method || 'NULL'}`)
  console.log(`   Created: ${new Date(order.created_at).toLocaleString()}`)
  console.log('')
})

// 2. Update first order with 'card' payment method
const firstOrderId = orders[0].id
console.log(`\n✏️  Updating order ${firstOrderId.substring(0, 8)}... with payment_method='card'...\n`)

const { data: updated, error: updateError } = await supabase
  .from('orders')
  .update({ payment_method: 'card' })
  .eq('id', firstOrderId)
  .select()
  .single()

if (updateError) {
  console.error('❌ Error updating order:', updateError)
  process.exit(1)
}

console.log('✅ Order updated successfully!')
console.log(`   Order ID: ${updated.id}`)
console.log(`   Payment Method: ${updated.payment_method}`)
console.log(`\nYou can now test by visiting:`)
console.log(`   http://localhost:3000/en/orders/${updated.id}`)
console.log('')
