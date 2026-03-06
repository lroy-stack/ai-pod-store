#!/usr/bin/env node
/**
 * Fix duplicated mockups for Grape, Navy, Sage, Graphite
 * Uses Flat option_group which gives Front + Back (via extra[])
 * Downloads both, uploads to Supabase Storage, updates images[]
 */
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const SB = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SK = get('SUPABASE_SERVICE_KEY');
const T = get('PRINTFUL_API_TOKEN');
const S = get('PRINTFUL_STORE_ID');
const pfH = { Authorization: `Bearer ${T}`, 'X-PF-Store-Id': S, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' };
const sbH = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };

const PID = '4fff5d51-0b07-4fed-98f6-455d5c4e3d28';
const CATALOG_ID = 586;

const frontUrl = 'https://files.cdn.printful.com/files/23a/23ab73702815c675b755672590ae3cf2_preview.png';
const sleeveUrl = 'https://files.cdn.printful.com/files/7a4/7a48a90ab209376b621482853a5ef45c_preview.png';
const backUrl = 'https://files.cdn.printful.com/files/d52/d52c0a1771381a65ad5b015de567877f_preview.png';

// CORRECT catalog variant IDs (S size)
const buggyColors = [
  { name: 'Grape', slug: 'grape', variantId: 22096 },
  { name: 'Navy', slug: 'navy', variantId: 15181 },
  { name: 'Sage', slug: 'sage', variantId: 21562 },
  { name: 'Graphite', slug: 'graphite', variantId: 21264 },
];

const delay = ms => new Promise(r => setTimeout(r, ms));

// Grape task already completed — reuse it
const GRAPE_TASK = 'gt-888926452';

async function createMockupTask(variantId) {
  const body = {
    variant_ids: [variantId],
    format: 'png', width: 1000,
    option_groups: ['Flat'],
    files: [
      { placement: 'front', image_url: frontUrl, position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
      { placement: 'sleeve_left', image_url: sleeveUrl, position: { area_width: 600, area_height: 525, width: 600, height: 525, top: 0, left: 0 } },
      { placement: 'back', image_url: backUrl, position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
    ]
  };
  const r = await fetch(`https://api.printful.com/mockup-generator/create-task/${CATALOG_ID}`, {
    method: 'POST', headers: pfH, body: JSON.stringify(body)
  });
  const d = await r.json();
  if (d.code === 429) {
    const waitSec = parseInt(d.error?.message?.match(/(\d+) seconds/)?.[1] || '60');
    console.log(`  Rate limited, waiting ${waitSec}s...`);
    await delay(waitSec * 1000 + 2000);
    return createMockupTask(variantId); // Retry
  }
  if (d.code !== 200) throw new Error(`Create task failed: ${d.error?.message || d.result}`);
  return d.result.task_key;
}

async function pollTask(taskKey) {
  for (let i = 0; i < 30; i++) {
    await delay(3000);
    const r = await (await fetch(`https://api.printful.com/mockup-generator/task?task_key=${taskKey}`, { headers: { ...pfH, 'Content-Type': undefined } })).json();
    if (r.result?.status === 'completed') return r.result;
    if (r.result?.status === 'error') throw new Error(`Task failed`);
    process.stdout.write('.');
  }
  throw new Error('Timeout');
}

async function downloadBuffer(url) {
  const r = await fetch(url);
  if (r.status !== 200) throw new Error(`Download failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function uploadToStorage(path, buffer) {
  const r = await fetch(`${SB}/storage/v1/object/designs/${path}`, {
    method: 'PUT',
    headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'image/png', 'x-upsert': 'true' },
    body: buffer
  });
  return r.status;
}

// ── Process each color ──
const results = [];

for (const color of buggyColors) {
  console.log(`\n=== ${color.name} ===`);

  try {
    let taskResult;

    if (color.name === 'Grape') {
      // Reuse existing completed task
      console.log(`  Reusing task ${GRAPE_TASK}`);
      taskResult = (await (await fetch(`https://api.printful.com/mockup-generator/task?task_key=${GRAPE_TASK}`, { headers: pfH })).json()).result;
    } else {
      const taskKey = await createMockupTask(color.variantId);
      console.log(`  Task: ${taskKey}`);
      taskResult = await pollTask(taskKey);
      console.log(' done');
    }

    // mockup_url = Front flat view (same across all placements)
    // extra[0].url = Back flat view
    const frontMockUrl = taskResult.mockups[0].mockup_url;
    const backMockUrl = taskResult.mockups[0].extra?.[0]?.url;

    // Download and upload Front
    const frontBuf = await downloadBuffer(frontMockUrl);
    console.log(`  Front: ${frontBuf.length} bytes`);
    const s1 = await uploadToStorage(`mockups/just-for-you/${color.slug}-front.png`, frontBuf);
    console.log(`  Upload front: ${s1}`);

    // Download and upload Back
    if (backMockUrl) {
      const backBuf = await downloadBuffer(backMockUrl);
      console.log(`  Back: ${backBuf.length} bytes`);
      const s2 = await uploadToStorage(`mockups/just-for-you/${color.slug}-back.png`, backBuf);
      console.log(`  Upload back: ${s2}`);
    }

    // Delete the left/sleeve duplicate from storage (if exists)
    const delRes = await fetch(`${SB}/storage/v1/object/designs`, {
      method: 'DELETE', headers: sbH,
      body: JSON.stringify({ prefixes: [`mockups/just-for-you/${color.slug}-left.png`] })
    });
    console.log(`  Deleted left dupe: ${delRes.status}`);

    results.push({ color: color.name, slug: color.slug, ok: true });

    // Rate limit
    if (color.name !== 'Grape') {
      console.log('  Waiting 12s...');
      await delay(12000);
    }

  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    results.push({ color: color.name, slug: color.slug, ok: false, error: err.message });
    await delay(15000);
  }
}

// ── Update images[] — remove sleeve entries for these colors, update timestamps ──
console.log('\n=== Updating products.images[] ===');
const product = (await (await fetch(`${SB}/rest/v1/products?select=images&id=eq.${PID}`, { headers: sbH })).json())[0];
let images = product.images || [];
const ts = Math.floor(Date.now() / 1000);
const BASE = `${SB}/storage/v1/object/public/designs/mockups/just-for-you`;

const successColors = new Set(results.filter(r => r.ok).map(r => r.color));

// Remove any remaining sleeve entries for these colors
images = images.filter(img => {
  const alt = img.alt || '';
  if (alt.includes(' - Sleeve')) {
    const color = alt.replace('Just For You - ', '').replace(' - Sleeve', '');
    if (successColors.has(color)) {
      console.log(`  Removing sleeve: ${alt}`);
      return false;
    }
  }
  return true;
});

// Update timestamps for replaced front/back
images = images.map(img => {
  const alt = img.alt || '';
  for (const r of results) {
    if (!r.ok) continue;
    if (alt === `Just For You - ${r.color}`) {
      return { ...img, src: `${BASE}/${r.slug}-front.png?v=${ts}` };
    }
    if (alt === `Just For You - ${r.color} - Back`) {
      return { ...img, src: `${BASE}/${r.slug}-back.png?v=${ts}` };
    }
  }
  return img;
});

console.log(`  Final image count: ${images.length}`);
const upd = await fetch(`${SB}/rest/v1/products?id=eq.${PID}`, {
  method: 'PATCH', headers: sbH, body: JSON.stringify({ images })
});
console.log(`  PATCH: ${upd.status}`);

console.log('\n=== SUMMARY ===');
results.forEach(r => console.log(`  ${r.color}: ${r.ok ? 'OK (front + back)' : 'FAILED - ' + r.error}`));
