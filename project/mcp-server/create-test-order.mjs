#!/usr/bin/env node
/**
 * Create a test order for the e2e test user
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read env vars
const envContent = readFileSync('/Users/lr0y/POD-AI-PDR/pod-agent-harness-v2/pod_workspace/project/frontend/.env.local', 'utf8');
const SUPABASE_URL = envContent.match(/^SUPABASE_URL=(.+)$/m)?.[1];
const SUPABASE_SERVICE_KEY = envContent.match(/^SUPABASE_SERVICE_KEY=(.+)$/m)?.[1];

// Use the hardcoded test user from OAuth provider (see auth/oauth-provider.ts)
const TEST_USER_ID = '5fae3de5-94e8-469d-a6a6-789fd08868d5';
const TEST_EMAIL = 'test@example.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('Test user ID:', TEST_USER_ID);

  // Check existing orders
  const { data: existingOrders } = await supabase
    .from('orders')
    .select('id, status, total_cents, currency')
    .eq('user_id', TEST_USER_ID);

  console.log(`\nExisting orders for ${TEST_EMAIL}:`, existingOrders?.length || 0);

  if (existingOrders && existingOrders.length > 0) {
    console.log('Sample order:', existingOrders[0]);
    console.log('\n✅ Test orders already exist');
    return;
  }

  // Create a test order
  console.log('\nCreating test order...');
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      user_id: TEST_USER_ID,
      status: 'delivered',
      total_cents: 2999, // $29.99
      currency: 'USD',
      customer_email: TEST_EMAIL,
      locale: 'en',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating order:', error);
    process.exit(1);
  }

  console.log('Created order:', order.id);
  console.log('Status:', order.status);
  console.log('Total:', order.total_cents / 100, order.currency);
  console.log('\n✅ Test order created successfully');
}

main().catch(console.error);
