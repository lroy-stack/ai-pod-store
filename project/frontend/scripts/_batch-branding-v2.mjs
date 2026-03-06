#!/usr/bin/env node
/**
 * Batch update branding v2 on all 11 Printful products.
 * Replaces sleeve_left and back file IDs while preserving front design.
 *
 * v2 File IDs (already in Printful File Library):
 *   sleeve_left: 950410444
 *   back:        950410495
 */
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const TOKEN = get('PRINTFUL_API_TOKEN');
const STORE = get('PRINTFUL_STORE_ID');

const V2_SLEEVE = 950410444;
const V2_BACK = 950410495;

const PRODUCTS = [
  { name: 'Just For You',       sync: 422030329 },
  { name: 'Next Line',          sync: 422030332 },
  { name: 'Shadow Tee',         sync: 422030396 },
  { name: 'Strawberry Count',   sync: 422030403 },
  { name: 'Three Models',       sync: 422030406 },
  { name: 'Under Where',        sync: 422030411 },
  { name: 'Existential Dread',  sync: 422030462 },
  { name: 'Plans Cancelled',    sync: 422030466 },
  { name: 'Self-Care Mode',     sync: 422030469 },
  { name: 'Social Battery',     sync: 422030473 },
  { name: 'Soup Fork',          sync: 422030479 },
];

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'X-PF-Store-Id': STORE,
  'Content-Type': 'application/json',
};

const delay = ms => new Promise(r => setTimeout(r, ms));

async function pfFetch(path, opts = {}) {
  const res = await fetch(`https://api.printful.com${path}`, { headers, ...opts });
  if (res.status === 429) {
    const reset = parseInt(res.headers.get('x-ratelimit-reset') || '60', 10);
    console.log(`  Rate limited, waiting ${reset}s...`);
    await delay(reset * 1000);
    return pfFetch(path, opts);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return null;
}

async function updateProduct(product, idx, total) {
  console.log(`[${idx + 1}/${total}] ${product.name} (sync ${product.sync})`);

  // 1. Get current product with all variants
  const data = await pfFetch(`/store/products/${product.sync}`);
  const variants = data.result.sync_variants;
  console.log(`  ${variants.length} variants`);

  // 2. Build update payload — keep front design, replace sleeve + back
  const syncVariants = variants.map(v => {
    const frontFile = v.files.find(f => f.type === 'default' || f.type === 'front');
    if (!frontFile) {
      console.log(`  WARNING: No front file on variant ${v.id} (${v.name})`);
      return null;
    }

    return {
      id: v.id,
      files: [
        { type: frontFile.type, id: frontFile.id },
        { type: 'sleeve_left', id: V2_SLEEVE },
        { type: 'back', id: V2_BACK },
      ],
    };
  }).filter(Boolean);

  // 3. PUT bulk update
  const res = await pfFetch(`/store/products/${product.sync}`, {
    method: 'PUT',
    body: JSON.stringify({ sync_variants: syncVariants }),
  });

  // 4. Verify first variant
  const v0 = res.result?.sync_variants?.[0];
  if (v0) {
    const sleeveOk = v0.files.some(f => f.type === 'sleeve_left' && f.id === V2_SLEEVE);
    const backOk = v0.files.some(f => f.type === 'back' && f.id === V2_BACK);
    console.log(`  sleeve_left v2: ${sleeveOk ? 'OK' : 'FAIL'}, back v2: ${backOk ? 'OK' : 'FAIL'}`);
  }

  return true;
}

async function main() {
  console.log(`Products to update: ${PRODUCTS.length}`);
  console.log(`v2 File IDs — sleeve: ${V2_SLEEVE}, back: ${V2_BACK}\n`);

  let ok = 0, fail = 0;
  for (let i = 0; i < PRODUCTS.length; i++) {
    try {
      await updateProduct(PRODUCTS[i], i, PRODUCTS.length);
      ok++;
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      fail++;
    }
    if (i < PRODUCTS.length - 1) await delay(3000);
  }

  console.log(`\nDone: ${ok} ok, ${fail} failed`);
}

main().catch(e => console.error(e));
