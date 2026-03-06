#!/usr/bin/env node
/**
 * Fix MC1087 Ghost duplicate bug.
 * Ghost front is CORRECT (auto from Printful). Back/sleeve are duplicates.
 *
 * Strategy: Keep Ghost front, generate Flat as 2nd view, delete duplicates.
 * Result: 2 distinct images per color (Ghost front + Flat).
 */
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();

const T = get('PRINTFUL_API_TOKEN'), S = get('PRINTFUL_STORE_ID');
const SB = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SK = get('SUPABASE_SERVICE_KEY');
const pfH = { Authorization: `Bearer ${T}`, 'X-PF-Store-Id': S, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' };
const sbH = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };

const delay = ms => new Promise(r => setTimeout(r, ms));

const V2_SLEEVE = 'https://files.cdn.printful.com/files/7a4/7a48a90ab209376b621482853a5ef45c_preview.png';
const V2_BACK = 'https://files.cdn.printful.com/files/d52/d52c0a1771381a65ad5b015de567877f_preview.png';

const COLORS = [
  { name: 'Black',         slug: 'black',         variantId: 23577 },
  { name: 'Navy Blazer',   slug: 'navy-blazer',   variantId: 23584 },
  { name: 'Vintage Black', slug: 'vintage-black',  variantId: 23591 },
];

const MC1087 = [
  { name: 'Existential Dread', sync: 422030462, dbId: '152676b0-4818-458b-8ffe-55e1b0a87877' },
  { name: 'Plans Cancelled',   sync: 422030466, dbId: 'a3b37e0f-636c-4a05-b680-b0f1151ff79b' },
  { name: 'Self-Care Mode',    sync: 422030469, dbId: '465edf9a-3abb-48d4-a7dc-68e6698eee87' },
  { name: 'Social Battery',    sync: 422030473, dbId: '2326f734-8025-42f7-82bf-847d0a5fb22c' },
  { name: 'Soup Fork',         sync: 422030479, dbId: '7d6f605a-df7c-4d63-b9f6-5f530035d3f2' },
];

async function createTask(variantId, optionGroup, filesArr) {
  const body = { variant_ids: [variantId], format: 'png', width: 1000, option_groups: [optionGroup], files: filesArr };
  const r = await fetch('https://api.printful.com/mockup-generator/create-task/917', {
    method: 'POST', headers: pfH, body: JSON.stringify(body)
  });
  const d = await r.json();
  if (d.code === 429) {
    const wait = parseInt(d.error?.message?.match(/(\d+) seconds/)?.[1] || '60');
    console.log(`      Rate limited ${wait}s...`);
    await delay(wait * 1000 + 2000);
    return createTask(variantId, optionGroup, filesArr);
  }
  if (d.code !== 200) throw new Error(`API ${d.code}: ${d.error?.message || JSON.stringify(d.result)}`);
  return d.result.task_key;
}

async function poll(taskKey) {
  for (let i = 0; i < 30; i++) {
    await delay(3000);
    const r = await (await fetch(`https://api.printful.com/mockup-generator/task?task_key=${taskKey}`, { headers: pfH })).json();
    if (r.result?.status === 'completed') return r.result;
    if (r.result?.status === 'error') throw new Error('Task error');
  }
  throw new Error('Timeout');
}

async function upload(path, buf) {
  return (await fetch(`${SB}/storage/v1/object/designs/${path}`, {
    method: 'PUT',
    headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'image/png', 'x-upsert': 'true' },
    body: buf
  })).status;
}

async function processProduct(product) {
  console.log(`\n=== ${product.name} ===`);

  // Get front design URL
  const pfData = await (await fetch(`https://api.printful.com/store/products/${product.sync}`, { headers: pfH })).json();
  if (pfData.code === 429) { await delay(62000); return processProduct(product); }
  const sv0files = pfData.result.sync_variants[0].files;
  const frontFile = sv0files.find(f => f.type === 'default') || sv0files.find(f => f.status === 'ok' && !['back','sleeve_left','preview'].includes(f.type));
  const frontDesignUrl = frontFile.preview_url;

  const slug = product.name.toLowerCase().replace(/\s+/g, '-');
  const basePath = `mockups/${slug}`;
  const ts = Math.floor(Date.now() / 1000);
  const SURL = `${SB}/storage/v1/object/public/designs/${basePath}`;

  const filesArr = [
    { placement: 'front', image_url: frontDesignUrl, position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
    { placement: 'sleeve_left', image_url: V2_SLEEVE, position: { area_width: 600, area_height: 525, width: 600, height: 525, top: 0, left: 0 } },
    { placement: 'back', image_url: V2_BACK, position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
  ];

  const images = [];

  for (const color of COLORS) {
    try {
      // Ghost front already exists in storage — keep it
      images.push({ src: `${SURL}/${color.slug}-front.png?v=${ts}`, alt: `${product.name} - ${color.name}` });

      // Generate Flat as 2nd distinct view
      console.log(`  ${color.name}: Flat...`);
      const flatKey = await createTask(color.variantId, 'Flat', filesArr);
      const flatRes = await poll(flatKey);
      const flatBuf = Buffer.from(await (await fetch(flatRes.mockups[0].mockup_url)).arrayBuffer());
      console.log(`  ${color.name}: ${flatBuf.length} bytes`);
      await upload(`${basePath}/${color.slug}-flat.png`, flatBuf);
      images.push({ src: `${SURL}/${color.slug}-flat.png?v=${ts}`, alt: `${product.name} - ${color.name} - Flat` });

      // Delete duplicates
      for (const s of ['back', 'sleeve_left']) {
        await fetch(`${SB}/storage/v1/object/designs/${basePath}/${color.slug}-${s}.png`, {
          method: 'DELETE', headers: { apikey: SK, Authorization: `Bearer ${SK}` }
        });
      }

      await delay(10000);
    } catch (err) {
      console.error(`  ${color.name} ERROR: ${err.message}`);
      images.push({ src: `${SURL}/${color.slug}-front.png?v=${ts}`, alt: `${product.name} - ${color.name}` });
      await delay(15000);
    }
  }

  // Update images[]
  const upd = await fetch(`${SB}/rest/v1/products?id=eq.${product.dbId}`, {
    method: 'PATCH', headers: sbH, body: JSON.stringify({ images })
  });
  console.log(`  images[]: ${images.length} → PATCH ${upd.status}`);
  return { name: product.name, ok: upd.status === 204, images: images.length };
}

const skipArg = process.argv.find(a => a.startsWith('--skip='));
const startFrom = skipArg ? parseInt(skipArg.split('=')[1], 10) : 0;

let products = MC1087.slice(startFrom);
console.log(`MC1087 fix: ${products.length} products (from ${startFrom})`);

const results = [];
for (let i = 0; i < products.length; i++) {
  results.push(await processProduct(products[i]));
  console.log(`  ── ${i+1}/${products.length} done, resume: --skip=${startFrom+i+1} ──`);
}

console.log('\n=== SUMMARY ===');
results.forEach(r => console.log(`  ${r.name}: ${r.ok ? 'OK' : 'FAIL'} — ${r.images} images`));
