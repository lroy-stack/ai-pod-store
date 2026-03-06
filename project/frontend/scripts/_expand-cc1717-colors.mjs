#!/usr/bin/env node
/**
 * Add extra color variants to CC1717 Printful sync products.
 *
 * Current state: Each CC1717 product only has 5 colors (Black, Graphite, Ivory, Pepper, True Navy).
 * We need to add 3-4 extra dark colors per product (from the batch script's design-first contrast config).
 *
 * For each product:
 * 1. GET sync product → find front design file ID from existing Black/S variant
 * 2. Determine which extra colors to add (from PRODUCTS config)
 * 3. For each extra color × 7 sizes: POST /store/products/{sync_id}/variants
 *
 * After running this, re-run the batch's syncMissingVariants or a separate sync
 * to create the corresponding rows in Supabase.
 */
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();

const T = get('PRINTFUL_API_TOKEN'), S = get('PRINTFUL_STORE_ID');
const pfH = { Authorization: `Bearer ${T}`, 'X-PF-Store-Id': S, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' };

const delay = ms => new Promise(r => setTimeout(r, ms));

// Branding file IDs (v2, shared across all products)
const SLEEVE_FILE_ID = 950410444;
const BACK_FILE_ID = 950410495;

// Catalog variant IDs per color × size (S, M, L, XL, 2XL, 3XL, 4XL)
const COLOR_VARIANTS = {
  Navy:     [21555, 21556, 21557, 21558, 21559, 21560, 21561],
  Sage:     [21562, 21563, 21564, 21565, 21566, 21567, 21568],
  Brick:    [15161, 15162, 15163, 15164, 15165, 16327, 17509],
  Grape:    [22096, 22097, 22098, 22099, 22100, 22101, 22102],
  Espresso: [21243, 21244, 21245, 21246, 21247, 21248, 21249],
  Paprika:  [17669, 17670, 17671, 17672, 17673, 17674, 17675],
};

const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

// Same product/color mapping as _batch-generate-mockups.mjs
const PRODUCTS = [
  { name: 'Just For You',     sync: 422030329, extras: ['Navy', 'Sage', 'Brick', 'Grape'] },
  { name: 'Next Line',        sync: 422030332, extras: ['Navy', 'Brick', 'Grape'] },
  { name: 'Shadow Tee',       sync: 422030396, extras: ['Navy', 'Sage', 'Grape', 'Espresso'] },
  { name: 'Strawberry Count', sync: 422030403, extras: ['Navy', 'Sage', 'Grape'] },
  { name: 'Three Models',     sync: 422030406, extras: ['Navy', 'Brick', 'Grape', 'Espresso'] },
  { name: 'Under Where',      sync: 422030411, extras: ['Navy', 'Sage', 'Brick', 'Grape'] },
  { name: 'Option Two',       sync: 422030337, extras: ['Navy', 'Sage', 'Brick', 'Grape'] },
  { name: 'Dangerous Flag',   sync: 422030313, extras: ['Navy', 'Sage', 'Brick', 'Grape'] },
  { name: 'Ghost Tee',        sync: 422030327, extras: ['Navy', 'Sage', 'Grape', 'Espresso'] },
  { name: 'Scope Creep',      sync: 422030382, extras: ['Navy', 'Grape', 'Espresso'] },
  { name: 'Prism Tee',        sync: 422030345, extras: ['Sage', 'Paprika', 'Espresso'] },
];

async function pfFetch(path, options = {}) {
  const url = `https://api.printful.com${path}`;
  const res = await fetch(url, { headers: pfH, ...options });
  const data = await res.json();
  if (data.code === 429) {
    const wait = parseInt(data.error?.message?.match(/(\d+) seconds/)?.[1] || '60');
    console.log(`    Rate limited, waiting ${wait}s...`);
    await delay(wait * 1000 + 2000);
    return pfFetch(path, options);
  }
  return data;
}

async function processProduct(product) {
  console.log(`\n=== ${product.name} (sync ${product.sync}) ===`);

  // 1. Get existing sync product to find front design file ID + existing colors
  const data = await pfFetch(`/store/products/${product.sync}`);
  if (data.code !== 200) {
    console.log(`  ERROR: ${data.error?.message || data.result}`);
    return { name: product.name, ok: false, error: 'fetch failed' };
  }

  const syncVariants = data.result.sync_variants;
  const existingColors = new Set();
  for (const sv of syncVariants) {
    const parts = sv.name.split(' / ');
    if (parts[1]) existingColors.add(parts[1]);
  }
  console.log(`  Existing colors: ${[...existingColors].join(', ')}`);

  // Find front design file ID from any existing variant
  const refVariant = syncVariants[0];
  const frontFile = refVariant.files.find(f => f.type === 'default' || f.type === 'front');
  if (!frontFile) {
    console.log(`  ERROR: No front design file found`);
    return { name: product.name, ok: false, error: 'no front file' };
  }
  const frontFileId = frontFile.id;
  console.log(`  Front design file ID: ${frontFileId}`);

  // Get retail price from existing variant
  const retailPrice = refVariant.retail_price;
  console.log(`  Retail price: $${retailPrice}`);

  // 2. Determine which extras to add
  const toAdd = product.extras.filter(c => !existingColors.has(c));
  if (toAdd.length === 0) {
    console.log(`  All extra colors already exist — skipping`);
    return { name: product.name, ok: true, added: 0, skipped: product.extras.length };
  }
  console.log(`  Colors to add: ${toAdd.join(', ')}`);

  // 3. Add each color × 7 sizes
  let created = 0;
  let errors = 0;

  for (const color of toAdd) {
    const variantIds = COLOR_VARIANTS[color];
    if (!variantIds) {
      console.log(`  WARNING: No variant IDs for ${color} — skipping`);
      continue;
    }

    for (let sizeIdx = 0; sizeIdx < SIZES.length; sizeIdx++) {
      const catalogVarId = variantIds[sizeIdx];
      const body = {
        variant_id: catalogVarId,
        retail_price: retailPrice,
        files: [
          { type: 'default', id: frontFileId },
          { type: 'back', id: BACK_FILE_ID },
          { type: 'sleeve_left', id: SLEEVE_FILE_ID },
        ],
      };

      const res = await pfFetch(`/store/products/${product.sync}/variants`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (res.code === 200) {
        created++;
      } else {
        console.log(`    FAIL: ${color}/${SIZES[sizeIdx]} — ${res.error?.message || res.result}`);
        errors++;
      }
      await delay(1500); // Rate limit
    }
    console.log(`  ${color}: ${SIZES.length} sizes added`);
  }

  console.log(`  Total: ${created} created, ${errors} errors`);
  return { name: product.name, ok: errors === 0, added: created, errors };
}

// --skip=N to resume
const skipArg = process.argv.find(a => a.startsWith('--skip='));
const startFrom = skipArg ? parseInt(skipArg.split('=')[1], 10) : 0;

// --only=syncId for single product
const onlyArg = process.argv.find(a => a.startsWith('--only='));
const onlySync = onlyArg ? parseInt(onlyArg.split('=')[1], 10) : null;

let products = PRODUCTS;
if (onlySync) {
  products = PRODUCTS.filter(p => p.sync === onlySync);
}

console.log(`Expanding CC1717 colors: ${products.length} products (starting from ${startFrom})`);

const results = [];
for (let i = startFrom; i < products.length; i++) {
  const r = await processProduct(products[i]);
  results.push(r);
  console.log(`  ── Progress: ${i - startFrom + 1}/${products.length - startFrom} done ──`);
  if (i < products.length - 1) await delay(3000);
}

console.log('\n=== SUMMARY ===');
results.forEach(r => {
  console.log(`  ${r.name}: ${r.ok ? 'OK' : 'ERRORS'} — ${r.added || 0} added, ${r.errors || 0} errors, ${r.skipped || 0} skipped`);
});

const totalAdded = results.reduce((s, r) => s + (r.added || 0), 0);
console.log(`\nTotal variants added: ${totalAdded}`);
console.log('\nNext step: Run syncMissingVariants to populate Supabase product_variants');
