#!/usr/bin/env node
/**
 * Create Origin Embroidered Hoodie on Printful
 * Cotton Heritage M2580 (catalog 380) — EMBROIDERY technique
 * White + Bone, EU Latvia fulfillment
 * 4 placements: chest_center, chest_left, wrist_left, wrist_right
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ─── ENV ─────────────────────────────────────────────────────────────
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = (key) => {
  const m = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'));
  if (!m) throw new Error(`Missing env: ${key}`);
  return m[1].trim();
};

const PF_TOKEN = env('PRINTFUL_API_TOKEN');
const PF_STORE = env('PRINTFUL_STORE_ID');
const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL');
const SB_KEY = env('SUPABASE_SERVICE_KEY');

const supabase = createClient(SB_URL, SB_KEY);

// ─── CONSTANTS ───────────────────────────────────────────────────────
const CATALOG_ID = 380;

const VARIANTS = {
  White: { S: 10774, M: 10775, L: 10776, XL: 10777, '2XL': 10778, '3XL': 13421 },
  Bone:  { S: 20284, M: 20285, L: 20286, XL: 20287, '2XL': 20288, '3XL': 20289 },
};

// Retail EUR → Printful wants string
const PRICES = {
  S: '59.99', M: '59.99', L: '59.99', XL: '59.99', '2XL': '64.99', '3XL': '69.99',
};

// NOTE: chest_center and chest_left are MUTUALLY EXCLUSIVE on Printful
// We use chest_center (the hero design with SKAPARA + 2026) = 3 placements total
const THREAD_COLORS = {
  embroidery_chest_center: ['#000000', '#6B5294', '#CC3333'],
  embroidery_wrist_left:   ['#000000'],
  embroidery_wrist_right:  ['#000000', '#6B5294', '#CC3333'],
};

const SVG_DIR = new URL('../public/brand-designs/origin-embroidery/', import.meta.url).pathname;
// chest_center + chest_left are mutually exclusive — use chest_center only
const DESIGNS = [
  { placement: 'embroidery_chest_center', file: 'chest-center.svg', w: 3000, h: 1800 },
  { placement: 'embroidery_wrist_left',   file: 'wrist-left.svg',   w: 600,  h: 900  },
  { placement: 'embroidery_wrist_right',  file: 'wrist-right.svg',  w: 600,  h: 900  },
];

const DESCRIPTIONS = {
  en: "The one that started everything. SKAPARA's founding embroidered hoodie — the origin year stitched in three-color thread, pixel blocks that tell a story from chest to wrist. Premium heavyweight cotton, four points of precision detail.",
  es: "La que lo empezó todo. La hoodie bordada fundacional de SKAPARA — el año de origen cosido en hilo de tres colores, bloques de píxel que cuentan una historia del pecho a la muñeca. Algodón premium de gramaje alto, cuatro puntos de detalle preciso.",
  de: "Das Stück, mit dem alles begann. SKAPARAs bestickter Gründungs-Hoodie — das Ursprungsjahr in dreifarbigem Garn gestickt, Pixelblöcke die eine Geschichte erzählen, von Brust bis Handgelenk. Premium-Baumwolle, vier Punkte präziser Stickerei.",
};

// ─── HELPERS ─────────────────────────────────────────────────────────
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function pf(path, opts = {}) {
  const url = `https://api.printful.com${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${PF_TOKEN}`,
      'X-PF-Store-Id': PF_STORE,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`❌ Printful ${res.status} ${path}:`, JSON.stringify(json));
    throw new Error(`Printful API error: ${res.status}`);
  }
  return json;
}

// ─── STEP 1: Render SVGs to PNG @300dpi ──────────────────────────────
console.log('\n═══ STEP 1: Render SVGs to PNG @300dpi ═══');
const pngPaths = {};

for (const d of DESIGNS) {
  const svgPath = `${SVG_DIR}${d.file}`;
  const pngPath = `/tmp/origin-${d.placement}.png`;
  console.log(`  Rendering ${d.file} → ${d.w}×${d.h}...`);
  execSync(`magick -density 300 -background transparent "${svgPath}" -resize ${d.w}x${d.h}! "${pngPath}"`);
  pngPaths[d.placement] = pngPath;
  console.log(`  ✓ ${pngPath}`);
}

// ─── STEP 2: Files already uploaded ──────────────────────────────────
console.log('\n═══ STEP 2: Using pre-uploaded file IDs ═══');

// Files uploaded in previous run — reuse IDs to save rate limits
const fileIds = {
  embroidery_chest_center: 950723276,
  embroidery_wrist_left:   950723322,
  embroidery_wrist_right:  950723335,
};

const publicUrls = {
  embroidery_chest_center: `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/origin/embroidery_chest_center.png`,
};

console.log('  File IDs:', fileIds);

console.log('\nFile IDs:', fileIds);

// ─── STEP 3: Create Sync Product ────────────────────────────────────
console.log('\n═══ STEP 3: Create Sync Product ═══');

// Build variants array
const syncVariants = [];
for (const [color, sizes] of Object.entries(VARIANTS)) {
  for (const [size, variantId] of Object.entries(sizes)) {
    syncVariants.push({
      variant_id: variantId,
      retail_price: PRICES[size],
      is_enabled: true,
      files: Object.entries(fileIds).map(([placement, fid]) => ({
        type: placement,
        id: fid,
      })),
      options: Object.entries(THREAD_COLORS).map(([placement, colors]) => ({
        id: `thread_colors_${placement.replace('embroidery_', '')}`,
        value: colors,
      })),
    });
  }
}

console.log(`  Creating product with ${syncVariants.length} variants...`);
const productResult = await pf('/store/products', {
  method: 'POST',
  body: JSON.stringify({
    sync_product: {
      name: 'Origin',
      thumbnail: publicUrls['embroidery_chest_center'],
    },
    sync_variants: syncVariants,
  }),
});

const pfProductId = productResult.result.id;
console.log(`  ✓ Printful product created: ID ${pfProductId}`);

// ─── STEP 4: GPSR (EU Regulation 2023/988) ──────────────────────────
console.log('\n═══ STEP 4: GPSR Safety Information ═══');
await delay(3000);

try {
  const gpsrTemplate = await pf(`/store/products/${pfProductId}/gpsr.json`);
  console.log('  GPSR template retrieved');

  await delay(2000);
  await pf(`/store/products/${pfProductId}/gpsr.json`, {
    method: 'PUT',
    body: JSON.stringify({
      safety_information: gpsrTemplate.result?.safety_information || '',
    }),
  });
  console.log('  ✓ GPSR accepted');
} catch (e) {
  console.log('  ⚠ GPSR step skipped (may need manual setup):', e.message);
}

// ─── STEP 5: Create Supabase Product ────────────────────────────────
console.log('\n═══ STEP 5: Create Supabase Product ═══');

const productId = crypto.randomUUID();
const now = new Date().toISOString();

const { error: insertErr } = await supabase.from('products').insert({
  id: productId,
  title: 'Origin',
  description: DESCRIPTIONS.en,
  category: 'pullover-hoodies',
  tags: ['embroidery', 'premium', 'founding', 'skapara', '2026'],
  base_price_cents: 5999,
  currency: 'EUR',
  images: [],
  status: 'active',
  translations: {
    es: { title: 'Origin', description: DESCRIPTIONS.es },
    de: { title: 'Origin', description: DESCRIPTIONS.de },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'Cotton Heritage M2580',
    material: '65% ring-spun cotton, 35% polyester (100% cotton face)',
    care_instructions: 'Machine wash cold, tumble dry low, do not bleach',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    provider_name: 'Printful',
    embroidery_placements: 3,
    thread_colors: 3,
  },
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: String(CATALOG_ID),
  blueprint_id: CATALOG_ID,
  print_provider_id: null,
  category_id: 'cc59f09e-3391-4672-8bea-805fb0628a47',
  published_at: now,
  created_at: now,
  updated_at: now,
});

if (insertErr) {
  console.error('  ❌ Supabase insert error:', insertErr);
  throw insertErr;
}
console.log(`  ✓ Product created: ${productId}`);

// ─── STEP 6: Create Supabase Variants ───────────────────────────────
console.log('\n═══ STEP 6: Create Supabase Variants ═══');

const sbVariants = [];
for (const [color, sizes] of Object.entries(VARIANTS)) {
  for (const [size, variantId] of Object.entries(sizes)) {
    const priceCents = parseInt(PRICES[size].replace('.', ''));
    sbVariants.push({
      product_id: productId,
      color,
      size,
      price_cents: priceCents,
      is_enabled: true,
      is_available: true,
      external_variant_id: String(variantId),
    });
  }
}

const { error: varErr } = await supabase.from('product_variants').insert(sbVariants);
if (varErr) {
  console.error('  ❌ Variants insert error:', varErr);
} else {
  console.log(`  ✓ ${sbVariants.length} variants created`);
}

// ─── STEP 7: Publish on Printful ─────────────────────────────────────
console.log('\n═══ STEP 7: Publish ═══');
await delay(3000);

try {
  await pf(`/store/products/${pfProductId}/publish.json`, {
    method: 'POST',
    body: '{}',
  });
  console.log('  ✓ Publish requested');
} catch (e) {
  console.log('  ⚠ Publish skipped:', e.message);
}

await delay(3000);

try {
  await pf(`/store/products/${pfProductId}/publishing_succeeded.json`, {
    method: 'POST',
    body: JSON.stringify({ external: { id: productId } }),
  });
  console.log('  ✓ Publishing confirmed with Supabase ID');
} catch (e) {
  console.log('  ⚠ Publishing confirmation skipped:', e.message);
}

// ─── STEP 8: Generate Ghost Mockups ──────────────────────────────────
console.log('\n═══ STEP 8: Generate Ghost Mockups ═══');

const MOCKUP_COLORS = {
  White: 10776,  // L variant
  Bone: 20286,   // L variant
};

for (const [color, variantId] of Object.entries(MOCKUP_COLORS)) {
  console.log(`\n  Generating mockup for ${color}...`);
  await delay(5000);

  try {
    const taskResult = await pf(`/mockup-generator/create-task/${CATALOG_ID}`, {
      method: 'POST',
      body: JSON.stringify({
        variant_ids: [variantId],
        format: 'png',
        width: 1000,
        option_groups: ['Ghost'],
        options: ['Front', 'Back'],
        files: Object.entries(fileIds).map(([placement, fid]) => ({
          placement,
          image_url: `https://files.printful.com/files/${fid}`,
          position: {
            area_width: DESIGNS.find(d => d.placement === placement).w,
            area_height: DESIGNS.find(d => d.placement === placement).h,
            width: DESIGNS.find(d => d.placement === placement).w,
            height: DESIGNS.find(d => d.placement === placement).h,
            top: 0,
            left: 0,
          },
        })),
      }),
    });

    const taskKey = taskResult.result.task_key;
    console.log(`  Task created: ${taskKey}`);

    // Poll for completion
    let mockups = null;
    for (let i = 0; i < 20; i++) {
      await delay(3000);
      const poll = await pf(`/mockup-generator/task?task_key=${taskKey}`);
      if (poll.result.status === 'completed') {
        mockups = poll.result.mockups;
        break;
      }
      if (poll.result.status === 'failed') {
        console.error(`  ❌ Mockup failed for ${color}:`, poll.result.error);
        break;
      }
      console.log(`  Polling... (${poll.result.status})`);
    }

    if (mockups) {
      console.log(`  ✓ ${color}: ${mockups.length} mockup views generated`);
      for (const m of mockups) {
        console.log(`    - ${m.placement || 'view'}: ${m.mockup_url?.substring(0, 80)}...`);
      }

      // Download and upload to Supabase Storage
      for (let idx = 0; idx < mockups.length; idx++) {
        const m = mockups[idx];
        const viewName = m.placement || `view-${idx}`;
        const fileName = `origin/${color.toLowerCase()}-${viewName}.png`;

        try {
          const imgRes = await fetch(m.mockup_url);
          const imgBuf = Buffer.from(await imgRes.arrayBuffer());

          await supabase.storage.from('designs').upload(
            `mockups/${fileName}`,
            imgBuf,
            { contentType: 'image/png', upsert: true }
          );
          console.log(`    ✓ Uploaded: mockups/${fileName}`);
        } catch (uploadErr) {
          console.log(`    ⚠ Upload failed for ${viewName}:`, uploadErr.message);
        }
      }
    }
  } catch (e) {
    console.log(`  ⚠ Mockup generation failed for ${color}:`, e.message);
    console.log('    (Embroidery mockups may not be supported — use manual photos)');
  }
}

// ─── STEP 9: Update Supabase Images ─────────────────────────────────
console.log('\n═══ STEP 9: Update Supabase Product Images ═══');

// List uploaded mockups
const { data: mockupFiles } = await supabase.storage.from('designs').list('mockups/origin');
const images = [];

if (mockupFiles && mockupFiles.length > 0) {
  for (const f of mockupFiles) {
    const src = `${SB_URL}/storage/v1/object/public/designs/mockups/origin/${f.name}?v=${Date.now()}`;
    const color = f.name.startsWith('white') ? 'White' : 'Bone';
    images.push({
      src,
      alt: `Origin — ${color}`,
    });
  }
}

if (images.length > 0) {
  const { error: imgErr } = await supabase.from('products').update({ images }).eq('id', productId);
  if (imgErr) console.error('  ❌ Image update error:', imgErr);
  else console.log(`  ✓ Updated with ${images.length} mockup images`);
} else {
  console.log('  ⚠ No mockup images available — product created without images');
  console.log('  → Mockups can be added later manually or via Printful dashboard');
}

// ─── SUMMARY ─────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('  ORIGIN EMBROIDERED HOODIE — CREATION COMPLETE');
console.log('═'.repeat(60));
console.log(`  Printful Product ID: ${pfProductId}`);
console.log(`  Supabase Product ID: ${productId}`);
console.log(`  Variants: ${sbVariants.length} (White + Bone × 6 sizes)`);
console.log(`  Placements: 4 embroidery`);
console.log(`  Pricing: €59.99 (S-XL), €64.99 (2XL), €69.99 (3XL)`);
console.log(`  Provider: Printful, EU Latvia`);
console.log('═'.repeat(60));

// ─── NEXT STEPS ──────────────────────────────────────────────────────
console.log('\n📋 NEXT STEPS:');
console.log('  1. Verify product in Printful Dashboard');
console.log('  2. Check GPSR is accepted');
console.log('  3. If mockups failed, download from Printful Dashboard manually');
console.log('  4. Delete old Printify Origin product from Supabase');
console.log(`     → Supabase ID: a88e3871-f55c-44da-9ae2-7c7c8c170bd5`);
console.log(`     → Printify ID: 69a229f244ef0b5de90cf93c`);
