#!/usr/bin/env node
/**
 * Check what variants exist in a Printful sync product
 * and compare against the colors the batch script uses
 */
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const T = get('PRINTFUL_API_TOKEN'), S = get('PRINTFUL_STORE_ID');
const pfH = { Authorization: `Bearer ${T}`, 'X-PF-Store-Id': S, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' };

const SYNC_ID = 422030332; // Next Line

const res = await fetch(`https://api.printful.com/store/products/${SYNC_ID}`, { headers: pfH });
const data = await res.json();

const variants = data.result.sync_variants;
console.log(`=== Printful Sync Product ${SYNC_ID} ===`);
console.log(`Product: ${data.result.sync_product.name}`);
console.log(`Variants: ${variants.length}`);

const byColor = {};
for (const v of variants) {
  const parts = v.name.split(' / ');
  const color = parts[1] || 'unknown';
  if (!byColor[color]) byColor[color] = { count: 0, example: v };
  byColor[color].count++;
}

console.log('\nColors in Printful:');
Object.entries(byColor).forEach(([c, d]) => {
  const ex = d.example;
  console.log(`  ${c.padEnd(16)} ${d.count} sizes | variant_id=${ex.variant_id} | retail=$${ex.retail_price}`);
});
