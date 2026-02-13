#!/usr/bin/env node
// Script to verify all 24 tables exist in Supabase

const tables = [
  'users', 'products', 'orders', 'designs', 'conversations',
  'shipping_addresses', 'product_variants', 'messages', 'cart_items', 'order_items',
  'wishlists', 'wishlist_items', 'product_reviews', 'notifications', 'translations',
  'audit_log', 'documents',
  'agent_sessions', 'agent_events',
  'customer_segments', 'demand_forecasts', 'price_history', 'association_rules',
  'ab_experiments', 'ab_events'
];

const SUPABASE_URL = 'https://your-project.supabase.co';
const ANON_KEY = 'your-supabase-anon-key';

async function checkTable(table) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=0`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });

    return {
      table,
      exists: response.status === 200,
      status: response.status
    };
  } catch (error) {
    return {
      table,
      exists: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('Checking 24 tables in Supabase...\n');

  const results = await Promise.all(tables.map(checkTable));

  const existing = results.filter(r => r.exists);
  const missing = results.filter(r => !r.exists);

  console.log(`✓ Existing tables (${existing.length}/24):`);
  existing.forEach(r => console.log(`  ✓ ${r.table}`));

  if (missing.length > 0) {
    console.log(`\n✗ Missing tables (${missing.length}/24):`);
    missing.forEach(r => console.log(`  ✗ ${r.table} (HTTP ${r.status || r.error})`));
  }

  console.log(`\nResult: ${existing.length}/24 tables exist`);
  process.exit(missing.length > 0 ? 1 : 0);
}

main();
