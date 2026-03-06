#!/usr/bin/env node
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const SB = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SK = get('SUPABASE_SERVICE_KEY');

const ids = [
  'a5867c4e-7f7d-48f0-82d4-052c0072ee6b',
  '4fff5d51-0b07-4fed-98f6-455d5c4e3d28'
];

for (const id of ids) {
  const row = (await (await fetch(`${SB}/rest/v1/products?id=eq.${id}&select=title,provider_product_id`, {
    headers: { apikey: SK, Authorization: `Bearer ${SK}` }
  })).json())[0];
  console.log(`${id} → ${row?.title || 'NOT FOUND'} (sync: ${row?.provider_product_id || '?'})`);
}
