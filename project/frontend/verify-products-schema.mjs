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

console.log('🔍 Verifying products table schema...\n');

// Try to select all columns we need to verify
const { data, error } = await supabase
  .from('products')
  .select('id, title, avg_rating, review_count')
  .limit(1);

if (error) {
  console.error('❌ Error querying products table:', error.message);
  process.exit(1);
}

if (data.length === 0) {
  console.error('❌ No products found in database');
  process.exit(1);
}

const product = data[0];

console.log('✅ Successfully queried products table with all required columns:');
console.log('   - avg_rating (NUMERIC(2,1))');
console.log('   - review_count (INTEGER)');

console.log('\n📋 Sample product record:');
console.log('   ID:', product.id);
console.log('   Title:', product.title);
console.log('   Avg Rating:', product.avg_rating, `(type: ${typeof product.avg_rating})`);
console.log('   Review Count:', product.review_count, `(type: ${typeof product.review_count})`);

// Verify data types
const avgRatingIsNumber = typeof product.avg_rating === 'number';
const reviewCountIsNumber = typeof product.review_count === 'number' && Number.isInteger(product.review_count);

if (!avgRatingIsNumber) {
  console.error('\n❌ avg_rating is not a number');
  process.exit(1);
}

if (!reviewCountIsNumber) {
  console.error('\n❌ review_count is not an integer');
  process.exit(1);
}

// Test creating a product with specific values
console.log('\n🧪 Testing product creation with specific rating values...');

const { data: testProduct, error: createError } = await supabase
  .from('products')
  .insert({
    title: 'Test Product Feature 33',
    description: 'Test product for verifying avg_rating and review_count columns',
    base_price_cents: 2999,
    currency: 'USD',
    avg_rating: 4.5,
    review_count: 42,
    status: 'draft'
  })
  .select()
  .single();

if (createError) {
  console.error('❌ Error creating test product:', createError.message);
  process.exit(1);
}

console.log('✅ Test product created:');
console.log('   Title:', testProduct.title);
console.log('   Avg Rating:', testProduct.avg_rating, '(expected: 4.5)');
console.log('   Review Count:', testProduct.review_count, '(expected: 42)');

// Verify the values match
if (testProduct.avg_rating !== 4.5) {
  console.error('\n❌ avg_rating value mismatch');
  process.exit(1);
}

if (testProduct.review_count !== 42) {
  console.error('\n❌ review_count value mismatch');
  process.exit(1);
}

console.log('\n✅ All required columns exist with correct data types!');
console.log('✅ Feature #33 verification: PASSED');
