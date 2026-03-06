#!/usr/bin/env node
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const SB = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SK = get('SUPABASE_SERVICE_KEY');

const PID = '4fff5d51-0b07-4fed-98f6-455d5c4e3d28';
const product = (await (await fetch(`${SB}/rest/v1/products?id=eq.${PID}&select=images`, {
  headers: { apikey: SK, Authorization: `Bearer ${SK}` }
})).json())[0];

console.log('=== Just For You — images[] ===');
console.log(`Total: ${product.images.length}`);
product.images.forEach((img, i) => {
  console.log(`  [${i}] alt: "${img.alt}"`);
});
