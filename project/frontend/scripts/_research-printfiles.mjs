#!/usr/bin/env node
/**
 * Get exact printfile specs (canvas dimensions, placements) for the 3 winners.
 * Also checks mockup option_groups available.
 */
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const T = get('PRINTFUL_API_TOKEN'), S = get('PRINTFUL_STORE_ID');
const pfH = { Authorization: `Bearer ${T}`, 'X-PF-Store-Id': S, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' };
const delay = ms => new Promise(r => setTimeout(r, ms));

const WINNERS = [
  { id: 380, name: 'Cotton Heritage M2580 — Premium Pullover Hoodie', type: 'HOODIE' },
  { id: 411, name: 'Cotton Heritage M2480 — Premium Sweatshirt (Crewneck)', type: 'CREWNECK' },
  { id: 692, name: 'Gildan 18600 — Heavy Blend Zip Hoodie', type: 'ZIP' },
];

for (const w of WINNERS) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${w.type}: ${w.name} (Catalog ID: ${w.id})`);
  console.log(`${'='.repeat(70)}`);

  // 1. Printfiles (canvas specs)
  console.log('\n  --- PRINTFILES (Canvas Specs) ---');
  const pfRes = await fetch(`https://api.printful.com/mockup-generator/printfiles/${w.id}`, { headers: pfH });
  const pfData = await pfRes.json();
  if (pfData.code === 429) {
    const wait = parseInt(pfData.error?.message?.match(/(\d+) seconds/)?.[1] || '30');
    console.log(`  Rate limited ${wait}s...`);
    await delay(wait * 1000 + 2000);
  }

  if (pfData.code === 200) {
    const pf = pfData.result;

    // Printfiles by placement
    const byPlacement = {};
    for (const f of pf.printfiles || []) {
      if (!byPlacement[f.placement]) byPlacement[f.placement] = [];
      byPlacement[f.placement].push(f);
    }

    for (const [placement, files] of Object.entries(byPlacement)) {
      const f = files[0];
      const extra = f.additional_price ? ` (+$${f.additional_price})` : ' (included)';
      console.log(`    ${placement.padEnd(25)} ${f.width}×${f.height}px @${f.dpi}dpi${extra}`);
      if (files.length > 1) {
        console.log(`      (${files.length} printfile variants for this placement)`);
      }
    }

    // Available placements summary
    console.log('\n  Available Placements:');
    for (const [key, val] of Object.entries(pf.available_placements || {})) {
      console.log(`    ${key}: "${val.title}"`);
    }

    // Variant count per placement
    console.log('\n  Variant → Printfile mapping:');
    const variantPlacements = {};
    for (const [varId, placements] of Object.entries(pf.variant_printfiles || {})) {
      const key = Object.entries(placements).map(([p, fid]) => p).sort().join('+');
      if (!variantPlacements[key]) variantPlacements[key] = 0;
      variantPlacements[key]++;
    }
    for (const [combo, count] of Object.entries(variantPlacements)) {
      console.log(`    ${combo}: ${count} variants`);
    }
  }

  await delay(3000);

  // 2. Mockup templates (option groups)
  console.log('\n  --- MOCKUP OPTION GROUPS ---');
  // We need to get a variant ID first
  const prodRes = await fetch(`https://api.printful.com/products/${w.id}`, { headers: pfH });
  const prodData = await prodRes.json();
  if (prodData.code === 200) {
    const variants = prodData.result.variants;
    // Find a Black variant for testing
    const blackVar = variants.find(v => v.color === 'Black');
    const testVarId = blackVar?.id || variants[0]?.id;

    console.log(`  Test variant: ${testVarId} (${blackVar?.color || variants[0]?.color})`);

    // Get mockup templates
    await delay(2000);
    const tmplRes = await fetch(`https://api.printful.com/mockup-generator/templates/${w.id}`, { headers: pfH });
    const tmplData = await tmplRes.json();

    if (tmplData.code === 200) {
      const groups = {};
      for (const t of tmplData.result.templates || []) {
        const g = t.option_group || 'default';
        if (!groups[g]) groups[g] = { options: new Set(), placements: new Set(), count: 0 };
        groups[g].count++;
        if (t.option) groups[g].options.add(t.option);
        if (t.placement) groups[g].placements.add(t.placement);
      }

      for (const [group, info] of Object.entries(groups).sort()) {
        console.log(`    ${group.padEnd(25)} ${info.count} templates, options: [${[...info.options].join(', ')}], placements: [${[...info.placements].join(', ')}]`);
      }
    } else {
      console.log(`  Templates API error: ${tmplData.code}`);
    }

    // Also print size range
    const sizes = [...new Set(variants.map(v => v.size))];
    console.log(`\n  Sizes: ${sizes.join(', ')}`);

    // Material info
    console.log(`\n  Full description:`);
    console.log(`  ${prodData.result.product.description?.substring(0, 500)}`);
  }

  await delay(3000);
}
