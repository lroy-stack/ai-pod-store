#!/usr/bin/env node
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const TOKEN = get('PRINTFUL_API_TOKEN');
const STORE = get('PRINTFUL_STORE_ID');
const h = { 'Authorization': `Bearer ${TOKEN}`, 'X-PF-Store-Id': STORE };

const delay = ms => new Promise(r => setTimeout(r, ms));

// V2 API for variants (paginated)
async function getAllVariants(catalogId, name) {
  let all = [];
  let url = `https://api.printful.com/v2/catalog-products/${catalogId}/catalog-variants?limit=100`;
  while (url) {
    const res = await fetch(url, { headers: h });
    const j = await res.json();
    all = all.concat(j.data || []);
    url = j._links?.next?.href || null;
    if (url) await delay(1000);
  }
  console.log(`\n=== ${name} (${catalogId}) — ${all.length} variants ===`);
  const colors = {};
  all.forEach(x => {
    if (!colors[x.color]) colors[x.color] = { hex: x.color_code, hex2: x.color_code2, sizes: [], ids: [] };
    colors[x.color].sizes.push(x.size);
    colors[x.color].ids.push(x.id);
  });
  console.log(`Colors: ${Object.keys(colors).length}\n`);
  Object.entries(colors).sort((a, b) => a[0].localeCompare(b[0])).forEach(([c, d]) => {
    console.log(`  ${c.padEnd(22)} ${(d.hex || '?').padEnd(10)} ${d.hex2 ? d.hex2 : ''.padEnd(10)} sizes: ${d.sizes.join(',').padEnd(28)} IDs: ${d.ids.join(',')}`);
  });
  return colors;
}

// Mockup templates for MC1087 (we already have CC1717 data)
async function getTemplates(catalogId, name) {
  const res = await fetch(`https://api.printful.com/mockup-generator/templates/${catalogId}`, { headers: h });
  const j = await res.json();
  const tpls = j.result?.templates || j.result || [];
  console.log(`\n=== ${name} (${catalogId}) MOCKUP TEMPLATES — ${Array.isArray(tpls) ? tpls.length : '?'} ===`);
  if (Array.isArray(tpls)) {
    // Group by URL pattern to understand unique views
    const views = {};
    tpls.forEach(t => {
      const urlParts = t.image_url?.match(/\/medium\/(.+?)\//) || ['', 'unknown'];
      const viewType = urlParts[1];
      if (!views[viewType]) views[viewType] = { count: 0, sampleId: t.template_id, placements: new Set() };
      views[viewType].count++;
      if (t.placements) t.placements.forEach(p => views[viewType].placements.add(p.placement_id || p));
    });
    Object.entries(views).forEach(([v, d]) => {
      console.log(`  ${v}: ${d.count} templates, placements: ${[...d.placements].join(',') || 'none listed'}`);
    });
    // Show first 3 raw templates for structure inspection
    console.log('\n  First 3 raw templates:');
    tpls.slice(0, 3).forEach(t => console.log(`  ${JSON.stringify(t)}`));
  }
}

// Also do a REAL mockup task test to see response structure
async function testMockupTask(catalogId, variantId, name) {
  console.log(`\n=== ${name} TEST MOCKUP TASK (variant ${variantId}) ===`);
  const body = {
    variant_ids: [variantId],
    format: 'png',
    width: 600,
    option_groups: ['Ghost'],
    options: ['Front', 'Back'],
    files: [{
      placement: 'front',
      image_url: 'https://files.cdn.printful.com/files/eab/eabb11262112b13353db2541262ac4d0_preview.png',
      position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 },
    }],
  };
  const res = await fetch(`https://api.printful.com/mockup-generator/create-task/${catalogId}`, {
    method: 'POST', headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (j.result?.task_key) {
    console.log(`  Task created: ${j.result.task_key}`);
    // Poll
    for (let i = 0; i < 20; i++) {
      await delay(3000);
      const pr = await fetch(`https://api.printful.com/mockup-generator/task?task_key=${j.result.task_key}`, { headers: h });
      const pj = await pr.json();
      if (pj.result?.status === 'completed') {
        console.log(`  COMPLETED — Full response structure:`);
        const mockups = pj.result.mockups || [];
        mockups.forEach((m, idx) => {
          console.log(`\n  Mockup[${idx}]:`);
          console.log(`    placement: ${m.placement}`);
          console.log(`    variant_ids: ${JSON.stringify(m.variant_ids)}`);
          console.log(`    mockup_url: ${m.mockup_url?.slice(0, 80)}...`);
          console.log(`    has extra: ${!!m.extra}, extra count: ${m.extra?.length || 0}`);
          if (m.extra) {
            m.extra.forEach((e, ei) => {
              console.log(`    extra[${ei}]: title="${e.title}", url=${e.url?.slice(0, 80)}...`);
            });
          }
          // Log ALL keys present on this mockup object
          console.log(`    ALL KEYS: ${Object.keys(m).join(', ')}`);
        });
        return;
      }
      if (pj.result?.status === 'failed') { console.log('  FAILED'); return; }
      process.stdout.write('.');
    }
    console.log('  TIMEOUT');
  } else {
    console.log(`  Error: ${JSON.stringify(j).slice(0, 300)}`);
  }
}

// Execute
await getAllVariants(586, 'CC1717 Comfort Colors');
await delay(2000);
await getAllVariants(917, 'MC1087 Cotton Heritage');
await delay(2000);
await getTemplates(917, 'MC1087');
await delay(2000);
// Test REAL mockup for MC1087 Black (23577) requesting Front+Back
await testMockupTask(917, 23577, 'MC1087 Black');
await delay(10000);
// Test REAL mockup for CC1717 Graphite (21264) requesting Front+Back — the "bug" question
await testMockupTask(586, 21264, 'CC1717 Graphite');
