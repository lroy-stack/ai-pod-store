#!/usr/bin/env node
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const SB = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SK = get('SUPABASE_SERVICE_KEY');
const sbH = { apikey: SK, Authorization: `Bearer ${SK}` };

const MC1087 = [
  { name: 'Existential Dread', sync: 422030462 },
  { name: 'Plans Cancelled',   sync: 422030466 },
  { name: 'Self-Care Mode',    sync: 422030469 },
  { name: 'Social Battery',    sync: 422030473 },
  { name: 'Soup Fork',         sync: 422030479 },
];

for (const p of MC1087) {
  const products = await (await fetch(
    `${SB}/rest/v1/products?provider_product_id=eq.${p.sync}&select=id,title,images`,
    { headers: sbH }
  )).json();

  if (!products?.length) { console.log(`${p.name}: NOT FOUND`); continue; }
  const prod = products[0];
  const imgs = prod.images || [];

  console.log(`\n=== ${p.name} (${prod.id}) ===`);
  console.log(`  Images: ${imgs.length}`);
  imgs.forEach((img, i) => {
    const src = img.src || img.url || '';
    const short = src.includes('supabase') ? 'SUPABASE: ' + src.split('/').slice(-2).join('/') :
                  src.includes('printful') ? 'PRINTFUL: ' + src.split('/').pop() : src.substring(0, 60);
    console.log(`  [${i}] ${short} | alt: "${img.alt || ''}"`);
  });

  // Check variants
  const variants = await (await fetch(
    `${SB}/rest/v1/product_variants?product_id=eq.${prod.id}&select=color,is_enabled&order=color`,
    { headers: sbH }
  )).json();
  const byColor = {};
  (variants || []).forEach(v => { if (!byColor[v.color]) byColor[v.color] = v.is_enabled; });
  console.log(`  Colors: ${Object.entries(byColor).map(([c,e]) => `${c}(${e?'ON':'OFF'})`).join(', ')}`);
}
