#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env.local file
const envPath = join(__dirname, '.env.local');
const envContent = readFileSync(envPath, 'utf-8');

const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const supabaseUrl = envVars.SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Verifying product_reviews table schema...\n');

// Get test data (user, product, order)
const { data: users, error: userError } = await supabase
  .from('users')
  .select('id')
  .limit(1);

if (userError || !users || users.length === 0) {
  console.error('❌ Error fetching user:', userError?.message || 'No users found');
  process.exit(1);
}

const userId = users[0].id;

const { data: products, error: productError } = await supabase
  .from('products')
  .select('id')
  .limit(1);

if (productError || !products || products.length === 0) {
  console.error('❌ Error fetching product:', productError?.message || 'No products found');
  process.exit(1);
}

const productId = products[0].id;

// Create a test order for the review
const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert({
    user_id: userId,
    total_cents: 5000,
    currency: 'USD',
    status: 'delivered',
    shipping_address: {
      full_name: 'Test User',
      street_line1: '123 Test St',
      city: 'Test City',
      postal_code: '12345',
      country_code: 'US'
    }
  })
  .select()
  .single();

if (orderError) {
  console.error('❌ Error creating test order:', orderError.message);
  process.exit(1);
}

const orderId = order.id;
console.log('✅ Test order created:', orderId);

// Test 1: Valid rating (within 1-5 range)
console.log('\n🧪 Test 1: Creating review with valid rating (3)...');
const { data: validReview, error: validError } = await supabase
  .from('product_reviews')
  .insert({
    product_id: productId,
    user_id: userId,
    order_id: orderId,
    rating: 3,
    title: 'Test Review',
    body: 'This is a test review with a valid rating'
  })
  .select()
  .single();

if (validError) {
  console.error('❌ Error creating valid review:', validError.message);
  process.exit(1);
}

console.log('✅ Valid review created with rating:', validReview.rating);

// Test 2: Try to create another review for same product/user/order (should fail - UNIQUE constraint)
console.log('\n🧪 Test 2: Testing UNIQUE constraint (duplicate review)...');
const { data: duplicateReview, error: duplicateError } = await supabase
  .from('product_reviews')
  .insert({
    product_id: productId,
    user_id: userId,
    order_id: orderId,
    rating: 4,
    title: 'Duplicate Review',
    body: 'This should fail'
  })
  .select()
  .single();

if (duplicateError) {
  if (duplicateError.code === '23505' || duplicateError.message.includes('duplicate') || duplicateError.message.includes('unique')) {
    console.log('✅ UNIQUE constraint working: duplicate review rejected');
  } else {
    console.error('❌ Unexpected error:', duplicateError.message);
    process.exit(1);
  }
} else {
  console.error('❌ UNIQUE constraint not working: duplicate review was added');
  process.exit(1);
}

// Test 3: Try to create a review with rating = 0 (should fail - CHECK constraint)
console.log('\n🧪 Test 3: Testing CHECK constraint (rating = 0)...');

// Create another order for this test
const { data: order2, error: order2Error } = await supabase
  .from('orders')
  .insert({
    user_id: userId,
    total_cents: 5000,
    currency: 'USD',
    status: 'delivered',
    shipping_address: {
      full_name: 'Test User',
      street_line1: '123 Test St',
      city: 'Test City',
      postal_code: '12345',
      country_code: 'US'
    }
  })
  .select()
  .single();

if (order2Error) {
  console.error('❌ Error creating second test order:', order2Error.message);
  process.exit(1);
}

const { data: invalidReview0, error: invalidError0 } = await supabase
  .from('product_reviews')
  .insert({
    product_id: productId,
    user_id: userId,
    order_id: order2.id,
    rating: 0,
    title: 'Invalid Review',
    body: 'This should fail'
  })
  .select()
  .single();

if (invalidError0) {
  if (invalidError0.code === '23514' || invalidError0.message.includes('check constraint') || invalidError0.message.includes('violates')) {
    console.log('✅ CHECK constraint working: rating = 0 rejected');
  } else {
    console.error('❌ Unexpected error:', invalidError0.message);
    process.exit(1);
  }
} else {
  console.error('❌ CHECK constraint not working: rating = 0 was accepted');
  process.exit(1);
}

// Test 4: Try to create a review with rating = 6 (should fail - CHECK constraint)
console.log('\n🧪 Test 4: Testing CHECK constraint (rating = 6)...');
const { data: invalidReview6, error: invalidError6 } = await supabase
  .from('product_reviews')
  .insert({
    product_id: productId,
    user_id: userId,
    order_id: order2.id,
    rating: 6,
    title: 'Invalid Review',
    body: 'This should fail'
  })
  .select()
  .single();

if (invalidError6) {
  if (invalidError6.code === '23514' || invalidError6.message.includes('check constraint') || invalidError6.message.includes('violates')) {
    console.log('✅ CHECK constraint working: rating = 6 rejected');
  } else {
    console.error('❌ Unexpected error:', invalidError6.message);
    process.exit(1);
  }
} else {
  console.error('❌ CHECK constraint not working: rating = 6 was accepted');
  process.exit(1);
}

// Test 5: Verify all ratings 1-5 are accepted
console.log('\n🧪 Test 5: Testing all valid ratings (1-5)...');
for (let rating = 1; rating <= 5; rating++) {
  const { data: testOrder, error: testOrderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      total_cents: 5000,
      currency: 'USD',
      status: 'delivered',
      shipping_address: {
        full_name: 'Test User',
        street_line1: '123 Test St',
        city: 'Test City',
        postal_code: '12345',
        country_code: 'US'
      }
    })
    .select()
    .single();

  if (testOrderError) {
    console.error(`❌ Error creating test order for rating ${rating}:`, testOrderError.message);
    process.exit(1);
  }

  const { data: testReview, error: testError } = await supabase
    .from('product_reviews')
    .insert({
      product_id: productId,
      user_id: userId,
      order_id: testOrder.id,
      rating: rating,
      title: `Test Review Rating ${rating}`,
      body: 'Testing rating constraint'
    })
    .select()
    .single();

  if (testError) {
    console.error(`❌ Error creating review with rating ${rating}:`, testError.message);
    process.exit(1);
  }

  console.log(`   ✅ Rating ${rating} accepted`);
}

console.log('\n✅ All product_reviews schema requirements verified!');
console.log('✅ Feature #35 verification: PASSED');
