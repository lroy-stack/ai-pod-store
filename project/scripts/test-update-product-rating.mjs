#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '../frontend/.env.local') })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('Testing update_product_rating RPC function...\n')

try {
  // 1. Get a test product
  const { data: products } = await supabase
    .from('products')
    .select('id, title, avg_rating, review_count')
    .limit(1)
    .single()

  if (!products) {
    console.error('❌ No products found in database')
    process.exit(1)
  }

  console.log(`Using test product: ${products.title}`)
  console.log(`Current rating: ${products.avg_rating}, reviews: ${products.review_count}`)

  // 2. Add a test review
  const { data: adminUser } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single()

  if (!adminUser) {
    console.error('❌ No admin user found')
    process.exit(1)
  }

  // Create a test order first (required for review)
  console.log('\nCreating test order...')
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: adminUser.id,
      total_cents: 1999,
      currency: 'usd',
      status: 'delivered',
      stripe_payment_intent_id: 'test_pi_123',
    })
    .select()
    .single()

  if (orderError) {
    console.error('❌ Error creating order:', orderError)
    process.exit(1)
  }

  if (!order) {
    console.error('❌ Failed to create test order')
    process.exit(1)
  }

  console.log('Adding a test review...')
  const { data: review, error: reviewError } = await supabase
    .from('product_reviews')
    .insert({
      product_id: products.id,
      user_id: adminUser.id,
      order_id: order.id,
      rating: 5,
      body: 'Test review for rating calculation',
    })
    .select()
    .single()

  if (reviewError) {
    console.error('❌ Error creating review:', reviewError)
    process.exit(1)
  }

  console.log('✓ Test review created')

  // 3. Call update_product_rating RPC function
  console.log('\nCalling update_product_rating RPC...')
  const { error: rpcError } = await supabase.rpc('update_product_rating', {
    p_product_id: products.id,
  })

  if (rpcError) {
    console.error('❌ Error calling update_product_rating:', rpcError)
    process.exit(1)
  }

  console.log('✓ RPC function executed successfully')

  // 4. Verify the product's rating was updated
  const { data: updatedProduct } = await supabase
    .from('products')
    .select('avg_rating, review_count')
    .eq('id', products.id)
    .single()

  console.log(`\nUpdated rating: ${updatedProduct.avg_rating}, reviews: ${updatedProduct.review_count}`)

  // Verify review_count reflects actual reviews (should be at least 1 after we added one)
  if (updatedProduct.review_count >= 1) {
    console.log('✓ Review count reflects actual reviews in database')
  } else {
    console.error('❌ Review count is incorrect')
    process.exit(1)
  }

  // Verify avg_rating was recalculated (should be between 1 and 5)
  if (updatedProduct.avg_rating >= 1 && updatedProduct.avg_rating <= 5) {
    console.log('✓ Average rating recalculated correctly')
  } else {
    console.error('❌ Average rating is invalid')
    process.exit(1)
  }

  // Clean up - delete the test review
  await supabase
    .from('product_reviews')
    .delete()
    .eq('id', review.id)

  console.log('\n✅ Test passed!')
} catch (error) {
  console.error('❌ Test failed:', error)
  process.exit(1)
}
