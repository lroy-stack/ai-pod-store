#!/usr/bin/env node
/**
 * Fix "Just For You" — create missing variant rows for Navy, Sage, Brick, Grape
 */
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const SB = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SK = get('SUPABASE_SERVICE_KEY');
const PID = '4fff5d51-0b07-4fed-98f6-455d5c4e3d28';
const headers = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const STORAGE_BASE = `${SB}/storage/v1/object/public/designs/mockups/just-for-you`;
const ts = Math.floor(Date.now() / 1000);

const newColorData = {
  Navy: {
    variants: [
      { size: 'S', id: '5218769691' },
      { size: 'S', id: '5218774028' },
      { size: 'M', id: '5218774676' },
      { size: 'L', id: '5218774683' },
      { size: 'XL', id: '5218774690' },
      { size: '2XL', id: '5218774691' },
      { size: '3XL', id: '5218774704' },
      { size: '4XL', id: '5218774705' },
    ]
  },
  Sage: {
    variants: [
      { size: 'S', id: '5218774710' },
      { size: 'M', id: '5218774773' },
      { size: 'L', id: '5218774798' },
      { size: 'XL', id: '5218774814' },
      { size: '2XL', id: '5218774835' },
      { size: '3XL', id: '5218774932' },
      { size: '4XL', id: '5218774940' },
    ]
  },
  Brick: {
    variants: [
      { size: 'S', id: '5218774941' },
      { size: 'M', id: '5218775676' },
      { size: 'L', id: '5218775743' },
      { size: 'XL', id: '5218775746' },
      { size: '2XL', id: '5218775754' },
      { size: '3XL', id: '5218775772' },
      { size: '4XL', id: '5218775782' },
    ]
  },
  Grape: {
    variants: [
      { size: 'S', id: '5218775784' },
      { size: 'M', id: '5218775786' },
      { size: 'L', id: '5218775794' },
      { size: 'XL', id: '5218775810' },
      { size: '2XL', id: '5218776422' },
      { size: '3XL', id: '5218776444' },
      { size: '4XL', id: '5218776445' },
    ]
  },
};

// Base cost by size (CC1717)
const costBySize = { S: 1325, M: 1325, L: 1325, XL: 1325, '2XL': 1625, '3XL': 1755, '4XL': 1885 };
// Retail price matching existing variants
const priceBySize = { S: 3809, M: 3809, L: 3809, XL: 3809, '2XL': 3809, '3XL': 3809, '4XL': 3809 };

let created = 0;
const seen = new Set();

for (const [color, data] of Object.entries(newColorData)) {
  const colorSlug = color.toLowerCase().replace(/\s+/g, '-');
  const imgUrl = `${STORAGE_BASE}/${colorSlug}-front.png?v=${ts}`;

  for (const v of data.variants) {
    // Skip duplicate Navy/S
    const key = `${color}|${v.size}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const sku = `SKP-JUST-FOR-${color.substring(0,4).toUpperCase()}-${v.size}`;
    const row = {
      product_id: PID,
      title: `${color} / ${v.size}`,
      color,
      size: v.size,
      is_enabled: true,
      is_available: true,
      price_cents: priceBySize[v.size],
      cost_cents: costBySize[v.size],
      image_url: imgUrl,
      external_variant_id: v.id,
      sku
    };

    const ins = await fetch(`${SB}/rest/v1/product_variants`, {
      method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(row)
    });

    if (ins.ok) {
      created++;
    } else {
      const err = await ins.text();
      console.log(`  ERROR ${color}/${v.size}: ${ins.status} ${err}`);
    }
  }
  console.log(`  ${color}: done`);
}

console.log(`\n=== ${created} variants created ===`);

// Verify
const vs = await (await fetch(`${SB}/rest/v1/product_variants?select=color,size,is_enabled&product_id=eq.${PID}&order=color,size`, { headers })).json();
const byColor = {};
vs.forEach(v => { if (!(v.color in byColor)) byColor[v.color] = { n: 0, en: 0 }; byColor[v.color].n++; if (v.is_enabled) byColor[v.color].en++; });
console.log('\nVerify:');
for (const [c,d] of Object.entries(byColor)) console.log(`  ${c}: ${d.n} total, ${d.en} enabled`);
