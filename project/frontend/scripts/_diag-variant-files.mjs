#!/usr/bin/env node
/**
 * Diagnostic: dump the files[] structure of the first sync variant
 * to understand the correct format for adding new variants
 */
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

  const v0 = data.result.sync_variants[0];
  console.log('=== FIRST VARIANT FILES ===');
  console.log(JSON.stringify(v0.files, null, 2));
  console.log('\n=== VARIANT META ===');
  console.log(`  sync_variant_id: ${v0.id}`);
  console.log(`  catalog_variant_id: ${v0.variant_id}`);
  console.log(`  name: ${v0.name}`);
  console.log(`  retail_price: ${v0.retail_price}`);

  // Also show the product-level files if any
  const product = data.result.sync_product;
  console.log('\n=== SYNC PRODUCT ===');
  console.log(`  id: ${product.id}`);
  console.log(`  name: ${product.name}`);
  console.log(`  variants: ${data.result.sync_variants.length}`);
}

main().catch(e => console.error(e));
