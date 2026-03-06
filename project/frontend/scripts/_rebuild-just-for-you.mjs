#!/usr/bin/env node
/**
 * REBUILD "Just For You" — complete:
 * 1. Get catalog variant IDs for missing colors (Navy, Sage, Brick, Grape)
 * 2. Add those variants to the sync product
 * 3. Generate Ghost mockups for ALL 8 dark colors (3 views each)
 * 4. Upload mockups to Supabase Storage
 * 5. Update products.images[] and product_variants.image_url
 */
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const PF_TOKEN = get('PRINTFUL_API_TOKEN');
const PF_STORE = get('PRINTFUL_STORE_ID');
const SB_URL = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SB_KEY = get('SUPABASE_SERVICE_KEY');

const SYNC_PRODUCT_ID = 422030329; // Just For You
const CATALOG_ID = 586; // CC1717
const PRICE = '38.09';
const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

// Colors we WANT (8 dark) — need to find catalog variant IDs for the missing 4
const TARGET_COLORS = ['Black', 'True Navy', 'Graphite', 'Pepper', 'Navy', 'Sage', 'Brick', 'Grape'];
const LIGHT_COLORS = ['Ivory', 'White']; // to disable

// File URLs for variant creation (url required, not just id)
const FRONT_URL = 'https://your-project.supabase.co/storage/v1/object/public/designs/printful-migration/front-just-for-you.png';
const BACK_URL = 'https://your-project.supabase.co/storage/v1/object/public/designs/branding/back-wordmark-v2-37pct.png';
const SLEEVE_URL = 'https://your-project.supabase.co/storage/v1/object/public/designs/branding/sleeve-left-v2-32pct.png';

// Branding preview URLs for mockup generator
const V2_SLEEVE_URL = 'https://files.cdn.printful.com/files/7a4/7a48a90ab209376b621482853a5ef45c_preview.png';
const V2_BACK_URL = 'https://files.cdn.printful.com/files/d52/d52c0a1771381a65ad5b015de567877f_preview.png';

const delay = ms => new Promise(r => setTimeout(r, ms));

// --- Printful API ---
const pfHeaders = {
  'Authorization': `Bearer ${PF_TOKEN}`,
  'X-PF-Store-Id': PF_STORE,
  'Content-Type': 'application/json',
};

async function pfFetch(path, opts = {}) {
  const res = await fetch(`https://api.printful.com${path}`, { headers: pfHeaders, ...opts });
  if (res.status === 429) {
    const reset = parseInt(res.headers.get('x-ratelimit-reset') || '60', 10);
    console.log(`  Rate limited, waiting ${reset}s...`);
    await delay(reset * 1000);
    return pfFetch(path, opts);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Printful ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// --- Supabase ---
async function uploadToStorage(storagePath, imageBuffer) {
  const res = await fetch(`${SB_URL}/storage/v1/object/designs/${storagePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SB_KEY}`,
      apikey: SB_KEY,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: Buffer.from(imageBuffer),
  });
  if (!res.ok) throw new Error(`Storage upload failed: ${res.status}`);
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.arrayBuffer();
}

async function sbQuery(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  return res.json();
}

async function sbPatch(table, filter, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

// ==============================
// STEP 1: Get catalog variant IDs for missing colors
// ==============================
async function getCatalogVariants() {
  console.log('=== STEP 1: Get catalog variants for CC1717 ===');
  const data = await pfFetch(`/products/${CATALOG_ID}`);
  const allVariants = data.result.variants;
  console.log(`  Total catalog variants: ${allVariants.length}`);

  // Build map: color → { size → variant_id }
  const colorSizeMap = {};
  for (const v of allVariants) {
    const color = v.color;
    const size = v.size;
    if (!colorSizeMap[color]) colorSizeMap[color] = {};
    colorSizeMap[color][size] = v.id;
  }

  // Show what we need
  for (const color of TARGET_COLORS) {
    const sizes = colorSizeMap[color];
    if (sizes) {
      console.log(`  ${color}: ${Object.keys(sizes).length} sizes (S=${sizes['S']})`);
    } else {
      console.log(`  ${color}: NOT FOUND in catalog`);
    }
  }

  return colorSizeMap;
}

// ==============================
// STEP 2: Add missing color variants to sync product
// ==============================
async function addMissingVariants(colorSizeMap) {
  console.log('\n=== STEP 2: Add missing variants ===');

  // Get current sync variants — check by catalog_variant_id to handle partial adds
  const data = await pfFetch(`/store/products/${SYNC_PRODUCT_ID}`);
  const existing = data.result.sync_variants;
  const existingVariantIds = new Set(existing.map(v => v.variant_id));
  const existingColors = new Set(existing.map(v => v.color));
  console.log(`  Existing colors: ${[...existingColors].join(', ')}`);
  console.log(`  Existing variant count: ${existing.length}`);

  // Find which specific size+color combos are missing
  let addedCount = 0;
  for (const color of TARGET_COLORS) {
    const sizes = colorSizeMap[color];
    if (!sizes) {
      console.log(`  SKIP ${color}: not in catalog`);
      continue;
    }

    for (const size of SIZES) {
      const variantId = sizes[size];
      if (!variantId) continue;

      if (existingVariantIds.has(variantId)) {
        continue; // Already exists
      }

      const body = {
        variant_id: variantId,
        retail_price: PRICE,
        files: [
          { type: 'default', url: FRONT_URL },
          { type: 'back', url: BACK_URL },
          { type: 'sleeve_left', url: SLEEVE_URL },
        ],
      };

      try {
        await pfFetch(`/store/products/${SYNC_PRODUCT_ID}/variants`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        addedCount++;
        console.log(`  Added: ${color}/${size} (variant ${variantId})`);
      } catch (err) {
        console.log(`  FAIL: ${color}/${size}: ${err.message.slice(0, 100)}`);
      }
      await delay(1500);
    }
  }
  console.log(`  Total added: ${addedCount}`);
}

// ==============================
// STEP 3: Generate mockups for all dark colors
// ==============================
async function generateMockups(colorSizeMap) {
  console.log('\n=== STEP 3: Generate Ghost mockups ===');

  // Get front design preview URL
  const data = await pfFetch(`/store/products/${SYNC_PRODUCT_ID}`);
  const v0 = data.result.sync_variants[0];
  const frontFile = v0.files.find(f => f.type === 'default' || f.type === 'front');
  const frontDesignUrl = frontFile.preview_url;
  console.log(`  Front design: ${frontDesignUrl.slice(0, 60)}...`);

  const title = data.result.sync_product.name;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const PLACEMENT_TO_VIEW = { front: 'front', back: 'back', sleeve_left: 'left' };
  const allMockups = []; // { color, colorSlug, placement, url }

  for (const color of TARGET_COLORS) {
    const variantId = colorSizeMap[color]?.['S'];
    if (!variantId) {
      console.log(`  SKIP ${color}: no variant ID for size S`);
      continue;
    }

    const colorSlug = color.toLowerCase().replace(/\s+/g, '-');
    console.log(`  ${color} (variant ${variantId})...`);

    try {
      // Create mockup task
      const taskBody = {
        variant_ids: [variantId],
        format: 'png',
        width: 1000,
        option_groups: ['Ghost'],
        options: ['Front', 'Left', 'Back'],
        files: [
          { placement: 'front', image_url: frontDesignUrl,
            position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
          { placement: 'sleeve_left', image_url: V2_SLEEVE_URL,
            position: { area_width: 600, area_height: 525, width: 600, height: 525, top: 0, left: 0 } },
          { placement: 'back', image_url: V2_BACK_URL,
            position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
        ],
      };

      const createRes = await pfFetch(`/mockup-generator/create-task/${CATALOG_ID}`, {
        method: 'POST',
        body: JSON.stringify(taskBody),
      });
      const taskKey = createRes.result.task_key;
      console.log(`    Task: ${taskKey}`);

      // Poll
      let mockups = null;
      for (let i = 0; i < 30; i++) {
        await delay(3000);
        const taskRes = await pfFetch(`/mockup-generator/task?task_key=${taskKey}`);
        if (taskRes.result.status === 'completed') {
          mockups = taskRes.result.mockups;
          break;
        }
        if (taskRes.result.status === 'failed') throw new Error('Mockup task failed');
      }
      if (!mockups) throw new Error('Mockup task timed out');
      console.log(`    Got ${mockups.length} mockup(s)`);

      // Extract using PLACEMENT (verified from diagnostic)
      for (const mock of mockups) {
        if (!mock.mockup_url || !mock.placement) continue;
        const view = PLACEMENT_TO_VIEW[mock.placement];
        if (!view) continue;

        const storagePath = `mockups/${slug}/${colorSlug}-${view}.png`;
        const imageData = await downloadImage(mock.mockup_url);
        await uploadToStorage(storagePath, imageData);
        const ts = Math.floor(Date.now() / 1000);
        allMockups.push({
          color, colorSlug, placement: view,
          url: `${SB_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`,
        });
        console.log(`    OK: ${colorSlug}-${view}.png`);
      }

    } catch (err) {
      console.log(`    ERROR: ${err.message.slice(0, 100)}`);
    }

    await delay(10000); // Rate limit
  }

  return { allMockups, title, slug };
}

// ==============================
// STEP 4: Update Supabase
// ==============================
async function updateSupabase(allMockups, title) {
  console.log('\n=== STEP 4: Update Supabase ===');

  // Get DB product ID
  const dbProducts = await sbQuery(`products?provider_product_id=eq.${SYNC_PRODUCT_ID}&select=id,title`);
  if (!dbProducts.length) { console.log('  NOT FOUND in Supabase'); return; }
  const dbId = dbProducts[0].id;
  console.log(`  DB id: ${dbId}`);

  // Build images[] — fronts first, then backs, then lefts
  const fronts = allMockups.filter(m => m.placement === 'front');
  const backs = allMockups.filter(m => m.placement === 'back');
  const lefts = allMockups.filter(m => m.placement === 'left');

  const images = [
    ...fronts.map(m => ({ src: m.url, alt: `${title} - ${m.color}` })),
    ...backs.map(m => ({ src: m.url, alt: `${title} - ${m.color} - Back` })),
    ...lefts.map(m => ({ src: m.url, alt: `${title} - ${m.color} - Sleeve` })),
  ];

  console.log(`  images[]: ${images.length} entries (${fronts.length} fronts, ${backs.length} backs, ${lefts.length} sleeves)`);

  const ok = await sbPatch('products', `id=eq.${dbId}`, { images });
  console.log(`  images[] update: ${ok ? 'OK' : 'FAIL'}`);

  // Update variant image_urls
  for (const front of fronts) {
    const ok = await sbPatch(
      'product_variants',
      `product_id=eq.${dbId}&color=eq.${encodeURIComponent(front.color)}`,
      { image_url: front.url }
    );
    console.log(`  variant image_url ${front.color}: ${ok ? 'OK' : 'FAIL'}`);
  }

  // Disable Ivory
  const disableOk = await sbPatch(
    'product_variants',
    `product_id=eq.${dbId}&color=eq.Ivory`,
    { is_enabled: false }
  );
  console.log(`  Disable Ivory: ${disableOk ? 'OK' : 'FAIL'}`);
}

// ==============================
// MAIN
// ==============================
async function main() {
  console.log('REBUILD: Just For You (sync ' + SYNC_PRODUCT_ID + ')\n');

  const colorSizeMap = await getCatalogVariants();
  await addMissingVariants(colorSizeMap);
  const { allMockups, title } = await generateMockups(colorSizeMap);
  await updateSupabase(allMockups, title);

  console.log('\n=== DONE ===');
  console.log(`Generated ${allMockups.length} mockup images for ${TARGET_COLORS.length} colors`);
}

main().catch(e => console.error('FATAL:', e));
