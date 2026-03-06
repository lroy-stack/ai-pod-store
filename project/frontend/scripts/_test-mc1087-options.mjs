#!/usr/bin/env node
/**
 * Test ALL MC1087 option groups to find which ones give distinct Back/Left views.
 * We need: Front (Ghost OK), Back (different view), Left (different view)
 */
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const T = get('PRINTFUL_API_TOKEN'), S = get('PRINTFUL_STORE_ID');
const pfH = { Authorization: `Bearer ${T}`, 'X-PF-Store-Id': S, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' };

const delay = ms => new Promise(r => setTimeout(r, ms));
const BLACK_S = 23577;

const frontUrl = 'https://files.cdn.printful.com/files/633/6335aef2a77d5f27e8958cb20ae43c66_preview.png';
const sleeveUrl = 'https://files.cdn.printful.com/files/7a4/7a48a90ab209376b621482853a5ef45c_preview.png';
const backUrl = 'https://files.cdn.printful.com/files/d52/d52c0a1771381a65ad5b015de567877f_preview.png';

const styles = ['Ghost', 'Flat', 'Folded', "Men's", "Men's Lifestyle"];

for (const style of styles) {
  console.log(`\n=== ${style} ===`);
  const body = {
    variant_ids: [BLACK_S], format: 'png', width: 1000,
    option_groups: [style],
    options: ['Front', 'Left', 'Back'],
    files: [
      { placement: 'front', image_url: frontUrl, position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
      { placement: 'sleeve_left', image_url: sleeveUrl, position: { area_width: 600, area_height: 525, width: 600, height: 525, top: 0, left: 0 } },
      { placement: 'back', image_url: backUrl, position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
    ]
  };

  let d;
  try {
    const r = await fetch('https://api.printful.com/mockup-generator/create-task/917', {
      method: 'POST', headers: pfH, body: JSON.stringify(body)
    });
    d = await r.json();
    if (d.code === 429) {
      const wait = parseInt(d.error?.message?.match(/(\d+) seconds/)?.[1] || '60');
      console.log(`  Rate limited ${wait}s...`);
      await delay(wait * 1000 + 2000);
      const r2 = await fetch('https://api.printful.com/mockup-generator/create-task/917', {
        method: 'POST', headers: pfH, body: JSON.stringify(body)
      });
      d = await r2.json();
    }
    if (d.code !== 200) { console.log(`  FAIL: ${d.error?.message}`); await delay(10000); continue; }
  } catch(e) { console.log(`  ERROR: ${e.message}`); continue; }

  const taskKey = d.result.task_key;
  for (let i = 0; i < 20; i++) {
    await delay(3000);
    const poll = await (await fetch(`https://api.printful.com/mockup-generator/task?task_key=${taskKey}`, { headers: pfH })).json();
    if (poll.result?.status === 'completed') {
      const mockups = poll.result.mockups;
      console.log(`  Mockups: ${mockups.length}`);

      // Check main URLs
      const allUrls = [];
      for (const m of mockups) {
        const fname = m.mockup_url.split('/').pop();
        allUrls.push(m.mockup_url);
        console.log(`  MAIN: placement=${m.placement} file=${fname}`);
        for (const e of m.extra || []) {
          const efname = e.url.split('/').pop();
          allUrls.push(e.url);
          console.log(`    EXTRA: title=${e.title} file=${efname}`);
        }
      }

      // Download and compare sizes
      const sizes = [];
      for (const url of allUrls.slice(0, 5)) {
        const buf = await (await fetch(url)).arrayBuffer();
        sizes.push(buf.byteLength);
      }
      const unique = new Set(sizes);
      console.log(`  Sizes: ${sizes.join(', ')} → ${unique.size} unique ${unique.size > 1 ? '✓ DISTINCT' : '⚠ SAME'}`);
      break;
    }
  }
  await delay(10000);
}
