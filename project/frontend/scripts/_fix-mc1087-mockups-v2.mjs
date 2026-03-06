#!/usr/bin/env node
/**
 * Fix MC1087 Ghost mockups — Extract 3 DISTINCT views correctly.
 *
 * Root cause: The batch script stored mockup_url from each placement object,
 * but ALL placements share the SAME mockup_url (front). The distinct Back/Left
 * views are in extra[] of the FIRST mockup object.
 *
 * Correct extraction:
 *   Front → mockups[0].mockup_url
 *   Back  → mockups[0].extra.find(e => e.title === 'Back').url
 *   Left  → mockups[0].extra.find(e => e.title === 'Left').url
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
  { name: 'Black',         slug: 'black',          variantId: 23577 },
  { name: 'Navy Blazer',   slug: 'navy-blazer',    variantId: 23584 },
  { name: 'Vintage Black', slug: 'vintage-black',  variantId: 23591 },
];

const MC1087 = [
  { name: 'Existential Dread', sync: 422030462, dbId: '152676b0-4818-458b-8ffe-55e1b0a87877' },
  { name: 'Plans Cancelled',   sync: 422030466, dbId: 'a3b37e0f-636c-4a05-b680-b0f1151ff79b' },
  { name: 'Self-Care Mode',    sync: 422030469, dbId: '465edf9a-3abb-48d4-a7dc-68e6698eee87' },
  { name: 'Social Battery',    sync: 422030473, dbId: '2326f734-8025-42f7-82bf-847d0a5fb22c' },
  { name: 'Soup Fork',         sync: 422030479, dbId: '7d6f605a-df7c-4d63-b9f6-5f530035d3f2' },
];

async function createGhostTask(variantId, filesArr) {
  const body = {
    variant_ids: [variantId],
    format: 'png',
    width: 1000,
    option_groups: ['Ghost'],
    options: ['Front', 'Left', 'Back'],
    files: filesArr,
  };
  const r = await fetch('https://api.printful.com/mockup-generator/create-task/917', {
    method: 'POST', headers: pfH, body: JSON.stringify(body),
  });
  const d = await r.json();
  if (d.code === 429) {
    const wait = parseInt(d.error?.message?.match(/(\d+) seconds/)?.[1] || '60');
    console.log(`      Rate limited ${wait}s...`);
    await delay(wait * 1000 + 2000);
    return createGhostTask(variantId, filesArr);
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
  const res = await fetch(`${SB}/storage/v1/object/designs/${path}`, {
    method: 'PUT',
    headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'image/png', 'x-upsert': 'true' },
    body: buf,
  });
  return res.status;
}

async function processProduct(product) {
  console.log(`\n=== ${product.name} ===`);

  // 1. Get front design URL from Printful
  const pfData = await (await fetch(`https://api.printful.com/store/products/${product.sync}`, { headers: pfH })).json();
  if (pfData.code === 429) { await delay(62000); return processProduct(product); }
  const sv0files = pfData.result.sync_variants[0].files;
  const frontFile = sv0files.find(f => f.type === 'default') || sv0files.find(f => f.type === 'front') || sv0files.find(f => f.status === 'ok' && !['back','sleeve_left','preview'].includes(f.type));
  if (!frontFile) throw new Error(`No front design found for ${product.name}`);
  const frontDesignUrl = frontFile.preview_url;
  console.log(`  Front design: ${frontFile.filename}`);

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
      console.log(`  ${color.name}: Creating Ghost task...`);
      const taskKey = await createGhostTask(color.variantId, filesArr);
      const result = await poll(taskKey);

      // CORRECT extraction: use FIRST mockup only
      const mockup = result.mockups[0];
      const frontUrl = mockup.mockup_url;
      const backExtra = (mockup.extra || []).find(e => e.title === 'Back');
      const leftExtra = (mockup.extra || []).find(e => e.title === 'Left');

      if (!backExtra || !leftExtra) {
        console.log(`  ${color.name}: WARNING — missing extras. Back=${!!backExtra} Left=${!!leftExtra}`);
        console.log(`  extras: ${JSON.stringify((mockup.extra || []).map(e => e.title))}`);
      }

      // Download all 3 views
      const frontBuf = Buffer.from(await (await fetch(frontUrl)).arrayBuffer());
      console.log(`    Front: ${frontBuf.length} bytes`);

      let backBuf = null;
      if (backExtra) {
        backBuf = Buffer.from(await (await fetch(backExtra.url)).arrayBuffer());
        console.log(`    Back:  ${backBuf.length} bytes`);
      }

      let leftBuf = null;
      if (leftExtra) {
        leftBuf = Buffer.from(await (await fetch(leftExtra.url)).arrayBuffer());
        console.log(`    Left:  ${leftBuf.length} bytes`);
      }

      // Verify distinct
      const sizes = [frontBuf.length, backBuf?.length, leftBuf?.length].filter(Boolean);
      const unique = new Set(sizes);
      console.log(`    Distinct: ${unique.size}/${sizes.length} ${unique.size >= 2 ? '✓' : '⚠'}`);

      // Upload to Supabase Storage
      const upFront = await upload(`${basePath}/${color.slug}-front.png`, frontBuf);
      console.log(`    Upload front: ${upFront}`);

      if (backBuf) {
        const upBack = await upload(`${basePath}/${color.slug}-back.png`, backBuf);
        console.log(`    Upload back: ${upBack}`);
      }

      if (leftBuf) {
        const upLeft = await upload(`${basePath}/${color.slug}-left.png`, leftBuf);
        console.log(`    Upload left: ${upLeft}`);
      }

      // Build images array entries
      images.push({ src: `${SURL}/${color.slug}-front.png?v=${ts}`, alt: `${product.name} - ${color.name}` });
      if (backBuf) images.push({ src: `${SURL}/${color.slug}-back.png?v=${ts}`, alt: `${product.name} - ${color.name} - Back` });
      if (leftBuf) images.push({ src: `${SURL}/${color.slug}-left.png?v=${ts}`, alt: `${product.name} - ${color.name} - Sleeve` });

      // Delete old duplicate files (sleeve_left naming from old batch)
      for (const old of ['sleeve_left']) {
        await fetch(`${SB}/storage/v1/object/designs/${basePath}/${color.slug}-${old}.png`, {
          method: 'DELETE', headers: { apikey: SK, Authorization: `Bearer ${SK}` },
        }).catch(() => {});
      }
      // Also delete flat files from previous fix attempt
      await fetch(`${SB}/storage/v1/object/designs/${basePath}/${color.slug}-flat.png`, {
        method: 'DELETE', headers: { apikey: SK, Authorization: `Bearer ${SK}` },
      }).catch(() => {});

      await delay(10000);
    } catch (err) {
      console.error(`  ${color.name} ERROR: ${err.message}`);
      // Keep front as fallback
      images.push({ src: `${SURL}/${color.slug}-front.png?v=${ts}`, alt: `${product.name} - ${color.name}` });
      await delay(15000);
    }
  }

  // Reorder: all fronts, then all backs, then all sleeves
  const fronts = images.filter(i => !i.alt.includes(' - Back') && !i.alt.includes(' - Sleeve'));
  const backs = images.filter(i => i.alt.includes(' - Back'));
  const sleeves = images.filter(i => i.alt.includes(' - Sleeve'));
  const ordered = [...fronts, ...backs, ...sleeves];

  // Update Supabase
  const upd = await fetch(`${SB}/rest/v1/products?id=eq.${product.dbId}`, {
    method: 'PATCH', headers: sbH, body: JSON.stringify({ images: ordered }),
  });
  console.log(`  images[]: ${ordered.length} (${fronts.length}F + ${backs.length}B + ${sleeves.length}S) → PATCH ${upd.status}`);
  return { name: product.name, ok: upd.status === 204, total: ordered.length };
}

// CLI
const skipArg = process.argv.find(a => a.startsWith('--skip='));
const startFrom = skipArg ? parseInt(skipArg.split('=')[1], 10) : 0;
const onlyArg = process.argv.find(a => a.startsWith('--only='));

let products = MC1087;
if (onlyArg) {
  const syncId = parseInt(onlyArg.split('=')[1], 10);
  products = MC1087.filter(p => p.sync === syncId);
} else {
  products = MC1087.slice(startFrom);
}

console.log(`MC1087 Ghost fix v2: ${products.length} products (from ${startFrom})`);
console.log('Strategy: Extract Front from mockup_url, Back+Left from extra[]');

const results = [];
for (let i = 0; i < products.length; i++) {
  results.push(await processProduct(products[i]));
  console.log(`  ── ${i + 1}/${products.length} done ──`);
}

console.log('\n=== SUMMARY ===');
results.forEach(r => console.log(`  ${r.name}: ${r.ok ? 'OK' : 'FAIL'} — ${r.total} images`));
