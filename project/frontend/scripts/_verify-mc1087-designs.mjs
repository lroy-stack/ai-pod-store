#!/usr/bin/env node
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const T = get('PRINTFUL_API_TOKEN'), S = get('PRINTFUL_STORE_ID');
const pfH = { Authorization: `Bearer ${T}`, 'X-PF-Store-Id': S, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' };
const delay = ms => new Promise(r => setTimeout(r, ms));

const MC1087 = [
  { name: 'Existential Dread', sync: 422030462 },
  { name: 'Plans Cancelled',   sync: 422030466 },
  { name: 'Self-Care Mode',    sync: 422030469 },
  { name: 'Social Battery',    sync: 422030473 },
  { name: 'Soup Fork',         sync: 422030479 },
];

for (const p of MC1087) {
  const res = await fetch(`https://api.printful.com/store/products/${p.sync}`, { headers: pfH });
  const data = await res.json();
  if (data.code === 429) {
    const wait = parseInt(data.error?.message?.match(/(\d+) seconds/)?.[1] || '30');
    console.log(`Rate limited, waiting ${wait}s...`);
    await delay(wait * 1000 + 2000);
    continue;
  }
  const sv = data.result.sync_variants[0];
  const front = sv.files.find(f => f.type === 'default' || f.type === 'front');
  const preview = sv.files.find(f => f.type === 'preview');
  console.log(`${p.name}:`);
  console.log(`  Front design: ${front?.filename || 'NONE'} (id: ${front?.id})`);
  console.log(`  Preview URL:  ${front?.preview_url?.split('/').pop() || 'NONE'}`);
  console.log(`  Source URL:   ${front?.url?.substring(0, 80) || 'NONE'}`);
  console.log();
  await delay(2000);
}
