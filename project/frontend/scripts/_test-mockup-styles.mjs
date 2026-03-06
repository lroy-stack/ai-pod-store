#!/usr/bin/env node
/**
 * Test which mockup option_groups produce DISTINCT images for Grape (buggy color)
 * We try: Folded, Zoomed in, Men's, Women's — see which give different front vs back
 */
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const T = get('PRINTFUL_API_TOKEN'), S = get('PRINTFUL_STORE_ID');
const pfH = { Authorization: `Bearer ${T}`, 'X-PF-Store-Id': S, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' };

const frontUrl = 'https://files.cdn.printful.com/files/23a/23ab73702815c675b755672590ae3cf2_preview.png';
const sleeveUrl = 'https://files.cdn.printful.com/files/7a4/7a48a90ab209376b621482853a5ef45c_preview.png';
const backUrl = 'https://files.cdn.printful.com/files/d52/d52c0a1771381a65ad5b015de567877f_preview.png';

const GRAPE_S = 22096; // catalog variant
const delay = ms => new Promise(r => setTimeout(r, ms));

const styles = ['Folded', 'Zoomed in', "Men's", "Women's"];

for (const style of styles) {
  console.log(`\n=== Testing: ${style} ===`);

  const body = {
    variant_ids: [GRAPE_S],
    format: 'png', width: 1000,
    option_groups: [style],
    files: [
      { placement: 'front', image_url: frontUrl, position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
      { placement: 'sleeve_left', image_url: sleeveUrl, position: { area_width: 600, area_height: 525, width: 600, height: 525, top: 0, left: 0 } },
      { placement: 'back', image_url: backUrl, position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
    ]
  };

  const r = await fetch('https://api.printful.com/mockup-generator/create-task/586', {
    method: 'POST', headers: pfH, body: JSON.stringify(body)
  });
  const d = await r.json();

  if (d.code === 429) {
    const wait = parseInt(d.error?.message?.match(/(\d+) seconds/)?.[1] || '60');
    console.log(`  Rate limited, waiting ${wait}s...`);
    await delay(wait * 1000 + 2000);
    // Retry
    const r2 = await fetch('https://api.printful.com/mockup-generator/create-task/586', {
      method: 'POST', headers: pfH, body: JSON.stringify(body)
    });
    const d2 = await r2.json();
    if (d2.code !== 200) { console.log(`  FAILED:`, d2.result); continue; }
    d.result = d2.result;
  } else if (d.code !== 200) {
    console.log(`  FAILED:`, d.result);
    continue;
  }

  const taskKey = d.result.task_key;
  console.log(`  Task: ${taskKey}`);

  // Poll
  for (let i = 0; i < 20; i++) {
    await delay(3000);
    const poll = await (await fetch(`https://api.printful.com/mockup-generator/task?task_key=${taskKey}`, { headers: pfH })).json();
    if (poll.result?.status === 'completed') {
      const mockups = poll.result.mockups;
      console.log(`  Mockups: ${mockups.length}`);

      // Check if URLs are distinct
      const urls = mockups.map(m => m.mockup_url);
      const uniqueUrls = new Set(urls);
      console.log(`  Unique main URLs: ${uniqueUrls.size}/${urls.length}`);

      mockups.forEach((m, i) => {
        const fname = m.mockup_url.split('/').pop();
        const extraCount = m.extra?.length || 0;
        const extraNames = (m.extra || []).map(e => e.title).join(', ');
        console.log(`  [${i}] placement=${m.placement} file=${fname} extras=${extraCount} (${extraNames})`);
      });

      if (uniqueUrls.size > 1) {
        console.log(`  ✓ DISTINCT IMAGES — this style works!`);
      } else {
        console.log(`  ✗ ALL SAME — bug affects this style too`);
        // Check extras
        const allExtras = mockups.flatMap(m => m.extra || []);
        if (allExtras.length > 0) {
          const extraUrls = new Set(allExtras.map(e => e.url));
          console.log(`  But has ${allExtras.length} extras with ${extraUrls.size} unique URLs`);
          allExtras.forEach(e => console.log(`    extra: ${e.title} — ${e.url.split('/').pop()}`));
        }
      }
      break;
    }
    process.stdout.write('.');
  }

  // Wait between tasks
  console.log('  Waiting 12s...');
  await delay(12000);
}
