#!/usr/bin/env node
/**
 * Inspect a Printful sync variant to understand the file structure
 * so we can replicate it for new color variants
 */
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const T = get('PRINTFUL_API_TOKEN'), S = get('PRINTFUL_STORE_ID');
const pfH = { Authorization: `Bearer ${T}`, 'X-PF-Store-Id': S, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' };

const SYNC_ID = 422030332; // Next Line

const res = await fetch(`https://api.printful.com/store/products/${SYNC_ID}`, { headers: pfH });
const data = await res.json();

// Find Black/S variant (first one typically)
const blackS = data.result.sync_variants.find(v => v.name.includes('Black') && v.name.includes('/ S'));
if (blackS) {
  console.log('=== Black/S variant ===');
  console.log('  id:', blackS.id);
  console.log('  variant_id (catalog):', blackS.variant_id);
  console.log('  retail_price:', blackS.retail_price);
  console.log('  files:', JSON.stringify(blackS.files, null, 2));
  console.log('  options:', JSON.stringify(blackS.options, null, 2));
}

// Also show product-level info
console.log('\n=== Product ===');
console.log('  name:', data.result.sync_product.name);
console.log('  id:', data.result.sync_product.id);
