#!/usr/bin/env node
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const SB = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SK = get('SUPABASE_SERVICE_KEY');

const PID = '4fff5d51-0b07-4fed-98f6-455d5c4e3d28';

// Check what the /api/products/[id] endpoint would query
const rows = await (await fetch(`${SB}/rest/v1/product_variants?product_id=eq.${PID}&select=id,color,size,is_enabled,is_available,external_variant_id,printify_variant_id&order=color,size`, {
  headers: { apikey: SK, Authorization: `Bearer ${SK}` }
})).json();

const byColor = {};
rows.forEach(r => {
  if (!byColor[r.color]) byColor[r.color] = { count: 0, enabled: 0, available: 0, hasExternal: 0, hasPrintify: 0 };
  byColor[r.color].count++;
  if (r.is_enabled) byColor[r.color].enabled++;
  if (r.is_available) byColor[r.color].available++;
  if (r.external_variant_id) byColor[r.color].hasExternal++;
  if (r.printify_variant_id) byColor[r.color].hasPrintify++;
});

console.log('=== Just For You — Variants by color ===');
console.log('Color'.padEnd(14), 'Total', 'Enabled', 'Available', 'ExtID', 'PrintifyID');
Object.entries(byColor).forEach(([c, d]) => {
  console.log(c.padEnd(14), String(d.count).padEnd(6), String(d.enabled).padEnd(8), String(d.available).padEnd(10), String(d.hasExternal).padEnd(6), d.hasPrintify);
});
