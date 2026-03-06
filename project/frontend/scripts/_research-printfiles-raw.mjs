#!/usr/bin/env node
/**
 * Get RAW printfile data to extract exact placement dimensions and costs.
 */
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const T = get('PRINTFUL_API_TOKEN'), S = get('PRINTFUL_STORE_ID');
const pfH = { Authorization: `Bearer ${T}`, 'X-PF-Store-Id': S, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' };
const delay = ms => new Promise(r => setTimeout(r, ms));

const WINNERS = [
  { id: 380, name: 'CH M2580 Hoodie' },
  { id: 411, name: 'CH M2480 Crewneck' },
  { id: 692, name: 'Gildan 18600 Zip' },
];

for (const w of WINNERS) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${w.name} (ID: ${w.id})`);
  console.log(`${'='.repeat(60)}`);

  // Raw printfiles
  const pfRes = await fetch(`https://api.printful.com/mockup-generator/printfiles/${w.id}`, { headers: pfH });
  const pfData = await pfRes.json();
  if (pfData.code === 429) {
    const wait = parseInt(pfData.error?.message?.match(/(\d+) seconds/)?.[1] || '30');
    console.log(`  Rate limited ${wait}s...`);
    await delay(wait * 1000 + 2000);
    continue;
  }
  if (pfData.code !== 200) { console.log(`  Error: ${pfData.code}`); continue; }

  const result = pfData.result;

  // Printfiles details
  console.log('\n  PRINTFILES:');
  for (const f of result.printfiles || []) {
    console.log(`    printfile_id=${f.printfile_id} width=${f.width} height=${f.height} dpi=${f.dpi} fill_mode=${f.fill_mode} can_rotate=${f.can_rotate}`);
    if (f.available_placements) {
      for (const [name, info] of Object.entries(f.available_placements)) {
        console.log(`      placement: ${name} → title="${info.title}" layers=${JSON.stringify(info.layers)}`);
      }
    }
  }

  // Available placements
  console.log('\n  AVAILABLE PLACEMENTS:');
  for (const [key, val] of Object.entries(result.available_placements || {})) {
    console.log(`    ${key}: ${JSON.stringify(val)}`);
  }

  // variant_printfiles (first 3)
  console.log('\n  VARIANT PRINTFILES (first 3):');
  const entries = Object.entries(result.variant_printfiles || {});
  for (const [varId, data] of entries.slice(0, 3)) {
    console.log(`    variant ${varId}: ${JSON.stringify(data)}`);
  }

  // option_groups from templates
  console.log('\n  TEMPLATES (raw first 5):');
  await delay(2000);
  const tmplRes = await fetch(`https://api.printful.com/mockup-generator/templates/${w.id}`, { headers: pfH });
  const tmplData = await tmplRes.json();
  if (tmplData.code === 200) {
    const templates = tmplData.result.templates || [];
    for (const t of templates.slice(0, 5)) {
      console.log(`    ${JSON.stringify(t)}`);
    }
    console.log(`    ... (${templates.length} total)`);

    // Unique option_groups
    const groups = [...new Set(templates.map(t => t.option_group).filter(Boolean))];
    console.log(`\n  OPTION GROUPS: ${groups.length > 0 ? groups.join(', ') : 'none (all default)'}`);

    // Unique options
    const options = [...new Set(templates.map(t => t.option).filter(Boolean))];
    console.log(`  OPTIONS: ${options.length > 0 ? options.join(', ') : 'none'}`);

    // Check background_color, background_url
    const bgs = [...new Set(templates.map(t => t.background_color).filter(Boolean))];
    console.log(`  BACKGROUND COLORS: ${bgs.join(', ')}`);
  }

  await delay(3000);
}
