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

console.log('🔍 Verifying wishlists table schema...\n');

// Get a user to create a wishlist for
const { data: users, error: userError } = await supabase
  .from('users')
  .select('id')
  .limit(1);

if (userError || !users || users.length === 0) {
  console.error('❌ Error fetching user:', userError?.message || 'No users found');
  process.exit(1);
}

const userId = users[0].id;

// Test 1: Create a private wishlist (share_token should be null)
console.log('🧪 Test 1: Creating private wishlist...');
const { data: privateWishlist, error: privateError } = await supabase
  .from('wishlists')
  .insert({
    user_id: userId,
    name: 'Private Test Wishlist',
    is_public: false,
    share_token: null
  })
  .select()
  .single();

if (privateError) {
  console.error('❌ Error creating private wishlist:', privateError.message);
  process.exit(1);
}

console.log('✅ Private wishlist created:');
console.log('   ID:', privateWishlist.id);
console.log('   Is Public:', privateWishlist.is_public, '(expected: false)');
console.log('   Share Token:', privateWishlist.share_token, '(expected: null)');

if (privateWishlist.is_public !== false) {
  console.error('❌ is_public should be false');
  process.exit(1);
}

if (privateWishlist.share_token !== null) {
  console.error('❌ share_token should be null for private wishlist');
  process.exit(1);
}

// Test 2: Create a public wishlist with share_token
console.log('\n🧪 Test 2: Creating public wishlist with share token...');
const shareToken = 'test_share_token_' + Date.now();
const { data: publicWishlist, error: publicError } = await supabase
  .from('wishlists')
  .insert({
    user_id: userId,
    name: 'Public Test Wishlist',
    is_public: true,
    share_token: shareToken
  })
  .select()
  .single();

if (publicError) {
  console.error('❌ Error creating public wishlist:', publicError.message);
  process.exit(1);
}

console.log('✅ Public wishlist created:');
console.log('   ID:', publicWishlist.id);
console.log('   Is Public:', publicWishlist.is_public, '(expected: true)');
console.log('   Share Token:', publicWishlist.share_token, '(expected:', shareToken + ')');

if (publicWishlist.is_public !== true) {
  console.error('❌ is_public should be true');
  process.exit(1);
}

if (publicWishlist.share_token !== shareToken) {
  console.error('❌ share_token mismatch');
  process.exit(1);
}

// Test 3: Verify UNIQUE constraint on wishlist_items
console.log('\n🧪 Test 3: Testing UNIQUE constraint on wishlist_items...');

// Get a product and variant (any variant will do)
const { data: variants, error: variantError } = await supabase
  .from('product_variants')
  .select('id, product_id')
  .limit(1);

if (variantError || !variants || variants.length === 0) {
  console.error('❌ Error fetching variant:', variantError?.message || 'No variants found');
  process.exit(1);
}

const variantId = variants[0].id;
const productId = variants[0].product_id;

// Add an item to the wishlist
const { data: item1, error: item1Error } = await supabase
  .from('wishlist_items')
  .insert({
    wishlist_id: privateWishlist.id,
    product_id: productId,
    variant_id: variantId
  })
  .select()
  .single();

if (item1Error) {
  console.error('❌ Error adding item to wishlist:', item1Error.message);
  process.exit(1);
}

console.log('✅ First item added to wishlist');

// Try to add the same item again (should fail with UNIQUE constraint violation)
const { data: item2, error: item2Error } = await supabase
  .from('wishlist_items')
  .insert({
    wishlist_id: privateWishlist.id,
    product_id: productId,
    variant_id: variantId
  })
  .select()
  .single();

if (item2Error) {
  // Check if it's a unique constraint violation
  if (item2Error.code === '23505' || item2Error.message.includes('duplicate') || item2Error.message.includes('unique')) {
    console.log('✅ UNIQUE constraint working: duplicate item rejected');
  } else {
    console.error('❌ Unexpected error:', item2Error.message);
    process.exit(1);
  }
} else {
  console.error('❌ UNIQUE constraint not working: duplicate item was added');
  process.exit(1);
}

console.log('\n✅ All wishlists schema requirements verified!');
console.log('✅ Feature #34 verification: PASSED');
