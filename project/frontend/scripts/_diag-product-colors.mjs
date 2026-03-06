#!/usr/bin/env node
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const PF_TOKEN = get('PRINTFUL_API_TOKEN');
const PF_STORE = get('PRINTFUL_STORE_ID');

const headers = {
  'Authorization': `Bearer ${PF_TOKEN}`,
  'X-PF-Store-Id': PF_STORE,
};

async function main() {
  const res = await fetch('https://api.printful.com/store/products/422030329', { headers });
  const data = await res.json();

  // Dump first variant completely to see the structure
  const v0 = data.result.sync_variants[0];
  console.log('=== FIRST VARIANT (full dump) ===');
  console.log(JSON.stringify(v0, null, 2));

  // List all variants with key fields
  console.log('\n=== ALL VARIANTS ===');
  for (const v of data.result.sync_variants) {
    console.log(`  sync_id=${v.id}  catalog_variant_id=${v.variant_id}  name="${v.name}"  color=${v.color || v.product?.color || '?'}  size=${v.size || v.product?.size || '?'}`);
  }
}

main().catch(e => console.error(e));
