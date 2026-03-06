#!/usr/bin/env node
/**
 * Extract complete variant ID tables for the 3 winners.
 * Output: color × size → variant_id, with EU availability.
 */
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const T = get('PRINTFUL_API_TOKEN'), S = get('PRINTFUL_STORE_ID');
const pfH = { Authorization: `Bearer ${T}`, 'X-PF-Store-Id': S, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' };
const delay = ms => new Promise(r => setTimeout(r, ms));

const PRODUCTS = [
  { id: 380, name: 'Cotton Heritage M2580 Hoodie' },
  { id: 411, name: 'Cotton Heritage M2480 Crewneck' },
  { id: 692, name: 'Gildan 18600 Zip Hoodie' },
];

const results = {};

for (const p of PRODUCTS) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${p.name} (Catalog ID: ${p.id})`);
  console.log(`${'='.repeat(70)}`);

  let data;
  while (true) {
    const r = await fetch(`https://api.printful.com/products/${p.id}`, { headers: pfH });
    data = await r.json();
    if (data.code === 429) {
      const wait = parseInt(data.error?.message?.match(/(\d+) seconds/)?.[1] || '30');
      console.log(`  Rate limited ${wait}s...`);
      await delay(wait * 1000 + 2000);
      continue;
    }
    break;
  }

  if (data.code !== 200) { console.log(`  ERROR: ${data.code}`); continue; }

  const variants = data.result.variants;
  const product = data.result.product;

  // Group by color
  const byColor = {};
  for (const v of variants) {
    const c = v.color;
    if (!byColor[c]) byColor[c] = { hex: v.color_code, variants: [], eu: false };
    byColor[c].variants.push({ size: v.size, id: v.id, price: v.price });
    const regions = Object.keys(v.availability_regions || {});
    if (regions.some(r => r.startsWith('EU'))) byColor[c].eu = true;
  }

  // Calculate luminosity for each color
  for (const [name, info] of Object.entries(byColor)) {
    const hex = info.hex.replace('#', '');
    const r = parseInt(hex.slice(0,2), 16);
    const g = parseInt(hex.slice(2,4), 16);
    const b = parseInt(hex.slice(4,6), 16);
    info.L = Math.round(0.299*r + 0.587*g + 0.114*b);
    info.isDark = info.L < 100;
  }

  // Print markdown table for VARIANTS.md
  const sizes = [...new Set(variants.map(v => v.size))].sort((a, b) => {
    const order = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
    return order.indexOf(a) - order.indexOf(b);
  });

  console.log(`\n### Variant ID Table\n`);
  console.log(`| Color | Hex | L | EU | ${sizes.join(' | ')} |`);
  console.log(`|---|---|---|---|${sizes.map(() => '---').join('|')}|`);

  for (const [name, info] of Object.entries(byColor).sort((a, b) => a[1].L - b[1].L)) {
    const ids = sizes.map(s => {
      const v = info.variants.find(v => v.size === s);
      return v ? v.id : '—';
    });
    const tier = info.isDark ? (info.eu ? '● DARK-EU' : '● DARK') : (info.eu ? '○ LIGHT-EU' : '○ LIGHT');
    console.log(`| ${name} | ${info.hex} | ${info.L} | ${info.eu ? 'YES' : 'NO'} | ${ids.join(' | ')} |`);
  }

  // Price analysis
  const prices = variants.map(v => parseFloat(v.price));
  console.log(`\n  Price: $${Math.min(...prices)} - $${Math.max(...prices)}`);
  console.log(`  Sizes: ${sizes.join(', ')}`);
  console.log(`  Total variants: ${variants.length}`);
  console.log(`  Colors: ${Object.keys(byColor).length} (${Object.values(byColor).filter(c => c.isDark && c.eu).length} dark EU)`);

  // Tier classification
  console.log(`\n### Color Tiers`);
  console.log(`\n  CORE DARK (EU, L<50):`);
  for (const [n, i] of Object.entries(byColor).filter(([,i]) => i.isDark && i.eu && i.L < 50).sort((a,b) => a[1].L - b[1].L)) {
    console.log(`    ${n} (${i.hex}, L=${i.L})`);
  }
  console.log(`\n  EXTENDED DARK (EU, 50≤L<100):`);
  for (const [n, i] of Object.entries(byColor).filter(([,i]) => i.isDark && i.eu && i.L >= 50).sort((a,b) => a[1].L - b[1].L)) {
    console.log(`    ${n} (${i.hex}, L=${i.L})`);
  }
  console.log(`\n  DARK NO-EU (L<100, no EU):`);
  for (const [n, i] of Object.entries(byColor).filter(([,i]) => i.isDark && !i.eu).sort((a,b) => a[1].L - b[1].L)) {
    console.log(`    ${n} (${i.hex}, L=${i.L})`);
  }
  console.log(`\n  LIGHT/DISABLED (L≥100):`);
  for (const [n, i] of Object.entries(byColor).filter(([,i]) => !i.isDark).sort((a,b) => a[1].L - b[1].L)) {
    console.log(`    ${n} (${i.hex}, L=${i.L}) ${i.eu ? 'EU' : ''}`);
  }

  results[p.id] = { byColor, sizes, product };
  await delay(3000);
}

// Save raw data
fs.writeFileSync('scripts/_variant-ids-raw.json', JSON.stringify(results, null, 2));
console.log('\n\nRaw data saved to scripts/_variant-ids-raw.json');
