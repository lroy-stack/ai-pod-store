#!/usr/bin/env node
/**
 * Generate Zoomed In mockups for Grape, Navy, Sage, Graphite
 * These colors have the Ghost bug (all views identical).
 * Strategy: Keep Ghost front + add 2 Zoomed In (front zoom + back zoom)
 *
 * Also re-generate Ghost front to ensure we have the real Ghost (not the Flat we overwrote)
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

const frontUrl = 'https://files.cdn.printful.com/files/23a/23ab73702815c675b755672590ae3cf2_preview.png';
const sleeveUrl = 'https://files.cdn.printful.com/files/7a4/7a48a90ab209376b621482853a5ef45c_preview.png';
const backUrl = 'https://files.cdn.printful.com/files/d52/d52c0a1771381a65ad5b015de567877f_preview.png';

const colors = [
  { name: 'Grape', slug: 'grape', variantId: 22096 },
  { name: 'Navy', slug: 'navy', variantId: 15181 },
  { name: 'Sage', slug: 'sage', variantId: 21562 },
  { name: 'Graphite', slug: 'graphite', variantId: 21264 },
];

const delay = ms => new Promise(r => setTimeout(r, ms));

const files = [
  { placement: 'front', image_url: frontUrl, position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
  { placement: 'sleeve_left', image_url: sleeveUrl, position: { area_width: 600, area_height: 525, width: 600, height: 525, top: 0, left: 0 } },
  { placement: 'back', image_url: backUrl, position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
];

async function createTask(variantId, optionGroup) {
  const body = {
    variant_ids: [variantId],
    format: 'png', width: 1000,
    option_groups: [optionGroup],
    files,
  };
  const r = await fetch('https://api.printful.com/mockup-generator/create-task/586', {
    method: 'POST', headers: pfH, body: JSON.stringify(body)
  });
  const d = await r.json();
  if (d.code === 429) {
    const wait = parseInt(d.error?.message?.match(/(\d+) seconds/)?.[1] || '60');
    console.log(`    Rate limited, waiting ${wait}s...`);
    await delay(wait * 1000 + 2000);
    return createTask(variantId, optionGroup);
  }
  if (d.code !== 200) throw new Error(`${d.error?.message || d.result}`);
  return d.result.task_key;
}

async function poll(taskKey) {
  for (let i = 0; i < 30; i++) {
    await delay(3000);
    const r = await (await fetch(`https://api.printful.com/mockup-generator/task?task_key=${taskKey}`, { headers: pfH })).json();
    if (r.result?.status === 'completed') return r.result;
    if (r.result?.status === 'error') throw new Error('Task error');
    process.stdout.write('.');
  }
  throw new Error('Timeout');
}

async function download(url) {
  const r = await fetch(url);
  return Buffer.from(await r.arrayBuffer());
}

async function upload(path, buf) {
  const r = await fetch(`${SB}/storage/v1/object/designs/${path}`, {
    method: 'PUT',
    headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'image/png', 'x-upsert': 'true' },
    body: buf
  });
  return r.status;
}

// ── Process each color: Ghost front + Zoomed In (front + back) ──
const results = [];

for (const color of colors) {
  console.log(`\n=== ${color.name} ===`);
  const base = `mockups/just-for-you/${color.slug}`;

  try {
    // 1) Re-generate Ghost front (the Flat overwrote it)
    console.log('  [Ghost front]');
    const ghostKey = await createTask(color.variantId, 'Ghost');
    console.log(`    Task: ${ghostKey}`);
    const ghostRes = await poll(ghostKey);
    console.log(' done');
    const ghostFrontUrl = ghostRes.mockups[0].mockup_url;
    const ghostBuf = await download(ghostFrontUrl);
    console.log(`    ${ghostBuf.length} bytes`);
    const s1 = await upload(`${base}-front.png`, ghostBuf);
    console.log(`    Upload: ${s1}`);

    await delay(12000);

    // 2) Generate Zoomed In (gives 2 distinct: front zoom + back zoom)
    console.log('  [Zoomed In]');
    const zoomKey = await createTask(color.variantId, 'Zoomed in');
    console.log(`    Task: ${zoomKey}`);
    const zoomRes = await poll(zoomKey);
    console.log(' done');

    // Zoomed In returns 4 mockups but only 2 unique URLs
    const zoomUrls = new Map();
    for (const m of zoomRes.mockups) {
      const fname = m.mockup_url.split('/').pop();
      if (!zoomUrls.has(fname)) {
        zoomUrls.set(fname, { url: m.mockup_url, placement: m.placement });
      }
    }

    let zoomIdx = 0;
    for (const [fname, data] of zoomUrls) {
      const suffix = zoomIdx === 0 ? 'zoomed-front' : 'zoomed-back';
      const buf = await download(data.url);
      console.log(`    ${suffix}: ${buf.length} bytes`);
      const s = await upload(`${base}-${suffix}.png`, buf);
      console.log(`    Upload: ${s}`);
      zoomIdx++;
    }

    results.push({ name: color.name, slug: color.slug, ok: true, zoomed: zoomUrls.size });
    console.log('  Waiting 12s...');
    await delay(12000);

  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    results.push({ name: color.name, slug: color.slug, ok: false, error: err.message });
    await delay(15000);
  }
}

// ── Update products.images[] ──
console.log('\n=== Updating products.images[] ===');
const product = (await (await fetch(`${SB}/rest/v1/products?select=images&id=eq.${PID}`, { headers: sbH })).json())[0];
let images = product.images || [];
const ts = Math.floor(Date.now() / 1000);
const SURL = `${SB}/storage/v1/object/public/designs/mockups/just-for-you`;

const okColors = results.filter(r => r.ok);

// Remove old back entries for these colors (they were Flat, wrong)
const okNames = new Set(okColors.map(r => r.name));
images = images.filter(img => {
  const alt = img.alt || '';
  if (alt.includes(' - Back')) {
    const color = alt.replace('Just For You - ', '').replace(' - Back', '');
    if (okNames.has(color)) {
      console.log(`  Removing old back: ${alt}`);
      return false;
    }
  }
  return true;
});

// Update Ghost front timestamps
images = images.map(img => {
  for (const c of okColors) {
    if (img.alt === `Just For You - ${c.name}`) {
      return { ...img, src: `${SURL}/${c.slug}-front.png?v=${ts}` };
    }
  }
  return img;
});

// Add Zoomed In entries after the fronts section
const newZoomed = [];
for (const c of okColors) {
  newZoomed.push(
    { src: `${SURL}/${c.slug}-zoomed-front.png?v=${ts}`, alt: `Just For You - ${c.name} - Zoomed Front` },
    { src: `${SURL}/${c.slug}-zoomed-back.png?v=${ts}`, alt: `Just For You - ${c.name} - Zoomed Back` },
  );
}

// Insert zoomed images after all fronts, before backs of non-buggy colors
// Structure: [fronts...] [zoomed...] [backs of good colors...] [sleeves of good colors...]
const fronts = images.filter(img => !img.alt?.includes(' - Back') && !img.alt?.includes(' - Sleeve') && !img.alt?.includes(' - Zoomed'));
const backs = images.filter(img => img.alt?.includes(' - Back'));
const sleeves = images.filter(img => img.alt?.includes(' - Sleeve'));

images = [...fronts, ...newZoomed, ...backs, ...sleeves];

console.log(`  Final image count: ${images.length}`);
const upd = await fetch(`${SB}/rest/v1/products?id=eq.${PID}`, {
  method: 'PATCH', headers: sbH, body: JSON.stringify({ images })
});
console.log(`  PATCH: ${upd.status}`);

// Also delete old Flat files from storage
console.log('\n=== Cleanup old Flat files ===');
for (const c of okColors) {
  // Delete flat back that was uploaded earlier
  const delRes = await fetch(`${SB}/storage/v1/object/designs`, {
    method: 'DELETE', headers: sbH,
    body: JSON.stringify({ prefixes: [`mockups/just-for-you/${c.slug}-back.png`] })
  });
  console.log(`  Deleted ${c.slug}-back.png: ${delRes.status}`);
}

console.log('\n=== SUMMARY ===');
results.forEach(r => console.log(`  ${r.name}: ${r.ok ? `OK — ghost front + ${r.zoomed} zoomed` : 'FAILED — ' + r.error}`));
