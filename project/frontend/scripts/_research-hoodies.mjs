#!/usr/bin/env node
/**
 * Research Printful catalog for hoodie/crewneck/zip candidates.
 * Gets detailed info: colors, EU availability, prices, placements.
 */
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const T = get('PRINTFUL_API_TOKEN'), S = get('PRINTFUL_STORE_ID');
const pfH = { Authorization: `Bearer ${T}`, 'X-PF-Store-Id': S, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' };
const delay = ms => new Promise(r => setTimeout(r, ms));

// Top candidates by category
const CANDIDATES = {
  'HOODIE (Pullover)': [380, 953, 970, 844, 975, 892, 602, 479],
  'CREWNECK / SWEATSHIRT': [411, 839, 971, 845, 1383, 493, 897],
  'ZIP HOODIE': [584, 943, 692],
};

async function getProductDetails(id) {
  const r = await fetch(`https://api.printful.com/products/${id}`, { headers: pfH });
  const d = await r.json();
  if (d.code === 429) {
    const wait = parseInt(d.error?.message?.match(/(\d+) seconds/)?.[1] || '30');
    console.log(`  Rate limited ${wait}s...`);
    await delay(wait * 1000 + 2000);
    return getProductDetails(id);
  }
  if (d.code !== 200) return null;
  return d.result;
}

async function getPrintfiles(id) {
  const r = await fetch(`https://api.printful.com/mockup-generator/printfiles/${id}`, { headers: pfH });
  const d = await r.json();
  if (d.code === 429) {
    await delay(32000);
    return getPrintfiles(id);
  }
  if (d.code !== 200) return null;
  return d.result;
}

const results = {};

for (const [category, ids] of Object.entries(CANDIDATES)) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${category}`);
  console.log(`${'='.repeat(60)}`);

  for (const id of ids) {
    console.log(`\n--- Product ${id} ---`);
    const data = await getProductDetails(id);
    if (!data) { console.log('  SKIP (error)'); await delay(3000); continue; }

    const p = data.product;
    const vs = data.variants;

    // Analyze colors
    const colors = {};
    let euCount = 0, totalCount = vs.length;
    for (const v of vs) {
      const c = v.color || '?';
      if (!colors[c]) colors[c] = { hex: v.color_code || '?', sizes: [], eu: false, price: v.price };
      colors[c].sizes.push(v.size);
      const regions = Object.keys(v.availability_regions || {});
      if (regions.some(r => r.startsWith('EU'))) {
        colors[c].eu = true;
        euCount++;
      }
    }

    const darkColors = Object.entries(colors).filter(([name, info]) => {
      const hex = info.hex.replace('#', '');
      if (hex.length !== 6) return false;
      const r = parseInt(hex.slice(0,2), 16);
      const g = parseInt(hex.slice(2,4), 16);
      const b = parseInt(hex.slice(4,6), 16);
      const L = 0.299*r + 0.587*g + 0.114*b;
      return L < 100; // Dark enough for white text
    });

    const euColors = Object.entries(colors).filter(([, info]) => info.eu);

    console.log(`  Title: ${p.title}`);
    console.log(`  Brand: ${p.brand || '?'}`);
    console.log(`  Type: ${p.type_name || '?'}`);
    console.log(`  Desc: ${(p.description || '').substring(0, 150)}`);
    console.log(`  Variants: ${totalCount} total, ${Object.keys(colors).length} colors`);
    console.log(`  EU available: ${euColors.length}/${Object.keys(colors).length} colors (${euCount}/${totalCount} variants)`);
    console.log(`  Dark colors (L<100): ${darkColors.length}`);
    console.log(`  Price range: $${Math.min(...Object.values(colors).map(c => parseFloat(c.price)))} - $${Math.max(...Object.values(colors).map(c => parseFloat(c.price)))}`);

    // Get placements
    console.log(`\n  Placements:`);
    const pf = await getPrintfiles(id);
    if (pf) {
      const placements = {};
      for (const f of pf.printfiles || []) {
        const pl = f.printfile_id;
        if (!placements[f.placement]) {
          placements[f.placement] = { width: f.width, height: f.height, dpi: f.dpi };
        }
      }
      // Also check available_placements
      for (const [key, val] of Object.entries(pf.available_placements || {})) {
        if (!placements[key]) placements[key] = { title: val.title };
      }
      for (const [name, info] of Object.entries(placements)) {
        console.log(`    ${name}: ${info.width || '?'}×${info.height || '?'}px @${info.dpi || '?'}dpi`);
      }
    }
    await delay(3000);

    // Print ALL colors with EU status
    console.log(`\n  All Colors:`);
    for (const [name, info] of Object.entries(colors).sort((a,b) => a[0].localeCompare(b[0]))) {
      const hex = info.hex;
      const isDark = darkColors.some(([n]) => n === name);
      console.log(`    ${isDark ? '●' : '○'} ${name.padEnd(25)} ${hex.padEnd(10)} ${info.sizes.length} sizes  ${info.eu ? 'EU' : '--'}  $${info.price}`);
    }

    results[id] = {
      title: p.title,
      brand: p.brand,
      totalColors: Object.keys(colors).length,
      euColors: euColors.length,
      darkColors: darkColors.length,
      priceMin: Math.min(...Object.values(colors).map(c => parseFloat(c.price))),
      priceMax: Math.max(...Object.values(colors).map(c => parseFloat(c.price))),
      totalVariants: totalCount,
      euVariants: euCount,
    };

    await delay(2000);
  }
}

// Summary table
console.log(`\n${'='.repeat(80)}`);
console.log('  RESUMEN COMPARATIVO');
console.log(`${'='.repeat(80)}`);
console.log(`${'ID'.padEnd(6)} ${'Title'.padEnd(55)} ${'Colors'.padEnd(8)} ${'EU'.padEnd(5)} ${'Dark'.padEnd(6)} ${'Price'.padEnd(15)}`);
for (const [id, r] of Object.entries(results)) {
  console.log(`${id.padEnd(6)} ${r.title.substring(0,54).padEnd(55)} ${String(r.totalColors).padEnd(8)} ${String(r.euColors).padEnd(5)} ${String(r.darkColors).padEnd(6)} $${r.priceMin}-$${r.priceMax}`);
}
