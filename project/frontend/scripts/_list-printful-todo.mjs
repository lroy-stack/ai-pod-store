#!/usr/bin/env node
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const url = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const key = get('SUPABASE_SERVICE_KEY');

const res = await fetch(`${url}/rest/v1/products?pod_provider=eq.printful&status=eq.active&select=id,title,provider_product_id,blueprint_id&order=title`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` }
});
const d = await res.json();

const skip = ['Prism Tee','Scope Creep','Dangerous Flag','Option Two','Ghost Tee'];
const todo = d.filter(p => !skip.includes(p.title));
const skipped = d.filter(p => skip.includes(p.title));

console.log('Active Printful products:', d.length);
console.log('Skipping:', skipped.map(p=>p.title).join(', '));
console.log('To process:', todo.length);
console.log('---');

// BP 6 = CC1717 (catalog 586 SIGNATURE)
// Other BPs might be MC1087 (catalog 917 PREMIUM)
todo.forEach((p,i) => {
  let catalog = 'CC1717(586)';
  if (p.blueprint_id === 12 || p.blueprint_id === 454 || p.blueprint_id === 1462) catalog = 'MC1087(917)';
  // bp 145 = different blank entirely
  if (p.blueprint_id === 145) catalog = `BP${p.blueprint_id}(?)`;
  console.log(`${i+1}. ${p.title.padEnd(22)} sync:${p.provider_product_id}  ${catalog}  bp:${p.blueprint_id}`);
});
