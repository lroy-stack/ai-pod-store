#!/usr/bin/env node
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const SB = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SK = get('SUPABASE_SERVICE_KEY');

const PID = '4fff5d51-0b07-4fed-98f6-455d5c4e3d28';
const rows = await (await fetch(`${SB}/rest/v1/product_variants?product_id=eq.${PID}&select=color,is_enabled,image_url&order=color`, {
  headers: { apikey: SK, Authorization: `Bearer ${SK}` }
})).json();

const byColor = {};
rows.forEach(r => { if (!byColor[r.color]) byColor[r.color] = r; });

console.log('=== Just For You — Variant image_url by color ===');
Object.entries(byColor).forEach(([c, r]) => {
  console.log(c.padEnd(14), r.is_enabled ? 'ON ' : 'OFF', r.image_url ? r.image_url.substring(0, 70) + '...' : 'NULL');
});
