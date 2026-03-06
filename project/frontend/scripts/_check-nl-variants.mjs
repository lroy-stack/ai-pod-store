#!/usr/bin/env node
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const SB = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SK = get('SUPABASE_SERVICE_KEY');

const PID = 'a5867c4e-7f7d-48f0-82d4-052c0072ee6b';
const rows = await (await fetch(`${SB}/rest/v1/product_variants?product_id=eq.${PID}&select=color,is_enabled,is_available,image_url&order=color`, {
  headers: { apikey: SK, Authorization: `Bearer ${SK}` }
})).json();

const byColor = {};
rows.forEach(r => { if (!byColor[r.color]) byColor[r.color] = { count: 0, enabled: 0 }; byColor[r.color].count++; if(r.is_enabled) byColor[r.color].enabled++; });

console.log('=== Next Line — Variants by color ===');
Object.entries(byColor).forEach(([c, d]) => {
  console.log(c.padEnd(14), `${d.enabled}/${d.count} enabled`);
});
console.log(`\nTotal colors: ${Object.keys(byColor).length}`);

// Also check images
const product = (await (await fetch(`${SB}/rest/v1/products?id=eq.${PID}&select=images`, {
  headers: { apikey: SK, Authorization: `Bearer ${SK}` }
})).json())[0];
console.log(`\n=== images[] count: ${product.images?.length || 0} ===`);
const colors = new Set();
(product.images || []).forEach(img => {
  const m = img.alt?.match(/- ([A-Za-z ]+?)( -|$)/);
  if (m) colors.add(m[1]);
});
console.log('Colors in images[]:', [...colors].join(', '));
