#!/usr/bin/env node
/**
 * Create SKAPARA Recycled '26 — Embroidered Hoodie on Printful
 * Stanley/Stella STSU177 (catalog 479) — EMBROIDERY technique
 * Desert Dust only, EU Latvia fulfillment
 * 2 placements: embroidery_chest_left ("26" pixel blocks) + embroidery_wrist_right (Recycled logo)
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
const CATALOG_ID = 479; // STSU177

// Desert Dust only — 5 sizes
const VARIANTS = {
  'Desert Dust': { S: 12382, M: 12383, L: 12384, XL: 12385, '2XL': 12386 },
};

const COLOR_HEX = { 'Desert Dust': '#dcccb4' };

// Retail EUR
const PRICES = {
  S: '74.99', M: '74.99', L: '74.99', XL: '74.99', '2XL': '79.99',
};

// Thread colors per placement
const THREAD_COLORS = {
  embroidery_chest_left:  ['#000000', '#01784E', '#7BA35A'],  // Black "2", Kelly Green "6", Kiwi Green underline
  embroidery_wrist_right: ['#01784E', '#7BA35A', '#FFFFFF'],  // Kelly Green S mark, Kiwi Green accent, White "RECYCLED"
};

const SVG_DIR = new URL('../public/brand-designs/recycled-embroidery/', import.meta.url).pathname;
const DESIGNS = [
  { placement: 'embroidery_chest_left',  file: 'chest-left-26.svg',   w: 1200, h: 1200 },
  { placement: 'embroidery_wrist_right', file: 'wrist-recycled.svg',  w: 600,  h: 900  },
];

const DESCRIPTIONS = {
  en: "Built different. The '26 pixel code stitched across the chest — a quiet signal for those who know. SKAPARA Recycled on the wrist, subtle as a whisper. 100% organic cotton, embroidered in Latvia.",
  es: "Hecho diferente. El código '26 en píxeles bordado en el pecho — una señal discreta para quien sabe mirar. SKAPARA Recycled en la muñeca, sutil como un susurro. 100% algodón orgánico, bordado en Letonia.",
  de: "Anders gemacht. Der '26 Pixelcode auf der Brust gestickt — ein leises Signal für Eingeweihte. SKAPARA Recycled am Handgelenk, dezent wie ein Flüstern. 100% Bio-Baumwolle, gestickt in Lettland.",
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
      'User-Agent': 'POD-AI-Store/1.0',
      ...opts.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`Printful ${res.status} ${path}:`, JSON.stringify(json));
    throw new Error(`Printful API error: ${res.status}`);
  }
  return json;
}

// ─── STEP 1: Render SVGs to PNG @300dpi ──────────────────────────────
console.log('\n=== STEP 1: Render SVGs to PNG @300dpi ===');
const pngPaths = {};

for (const d of DESIGNS) {
  const svgPath = `${SVG_DIR}${d.file}`;
  const pngPath = `/tmp/recycled26-${d.placement}.png`;
  console.log(`  Rendering ${d.file} -> ${d.w}x${d.h}...`);
  execSync(`magick -density 300 -background transparent "${svgPath}" -resize ${d.w}x${d.h}! PNG32:"${pngPath}"`);
  pngPaths[d.placement] = pngPath;
  console.log(`  OK: ${pngPath}`);
}

// ─── STEP 2: Upload PNGs to Supabase Storage ────────────────────────
console.log('\n=== STEP 2: Upload PNGs to Supabase Storage ===');
const publicUrls = {};

for (const d of DESIGNS) {
  const pngPath = pngPaths[d.placement];
  const pngBuffer = readFileSync(pngPath);
  const storagePath = `embroidery-sources/recycled-26/${d.placement}.png`;

  const { error: upErr } = await supabase.storage.from('designs').upload(
    storagePath,
    pngBuffer,
    { contentType: 'image/png', upsert: true }
  );
  if (upErr) {
    console.error(`  Upload error for ${d.placement}:`, upErr);
    throw upErr;
  }

  publicUrls[d.placement] = `${SB_URL}/storage/v1/object/public/designs/${storagePath}`;
  console.log(`  OK: ${storagePath}`);
}

// ─── STEP 3: Upload to Printful File Library ─────────────────────────
console.log('\n=== STEP 3: Upload to Printful File Library ===');
const fileIds = {};

for (const d of DESIGNS) {
  await delay(3000);
  const result = await pf('/files', {
    method: 'POST',
    body: JSON.stringify({
      url: publicUrls[d.placement],
      filename: `recycled-26-${d.placement}.png`,
    }),
  });
  fileIds[d.placement] = result.result.id;
  console.log(`  OK: ${d.placement} -> file ID ${result.result.id}`);
}

console.log('  File IDs:', fileIds);

// ─── STEP 4: Create Sync Product ────────────────────────────────────
console.log('\n=== STEP 4: Create Sync Product ===');

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
      name: "Recycled '26",
      thumbnail: publicUrls['embroidery_chest_left'],
    },
    sync_variants: syncVariants,
  }),
});

const pfProductId = productResult.result.id;
console.log(`  OK: Printful product ID ${pfProductId}`);

// ─── STEP 5: GPSR (EU Regulation 2023/988) ──────────────────────────
console.log('\n=== STEP 5: GPSR Safety Information ===');
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
  console.log('  OK: GPSR accepted');
} catch (e) {
  console.log('  WARN: GPSR skipped (embroidery may need Supabase):', e.message);
}

// ─── STEP 6: Create Supabase Product ────────────────────────────────
console.log('\n=== STEP 6: Create Supabase Product ===');

const productId = crypto.randomUUID();
const now = new Date().toISOString();

const { error: insertErr } = await supabase.from('products').insert({
  id: productId,
  title: "Recycled '26",
  description: DESCRIPTIONS.en,
  category: 'pullover-hoodies',
  tags: ['embroidery', 'recycled', 'eco', 'organic', 'skapara', '26'],
  base_price_cents: 7499,
  currency: 'EUR',
  images: [],
  status: 'active',
  translations: {
    es: { title: "Recycled '26", description: DESCRIPTIONS.es },
    de: { title: "Recycled '26", description: DESCRIPTIONS.de },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'Stanley/Stella STSU177',
    tier: 'ESSENTIAL ECO',
    material: '100% organic cotton (GOTS certified), 10.32 oz/yd² (350 g/m²)',
    care_instructions: 'Hand wash cold, inside out. Do not bleach. Air dry. Do not iron on embroidery.',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    provider_name: 'Printful',
    certifications: 'GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan',
    embroidery_placements: 2,
    thread_colors: 4,
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p><p><strong>Material:</strong> 100% organic cotton (GOTS certified)</p><p><strong>Weight:</strong> 10.32 oz/yd² (350 g/m²)</p><p><strong>Technique:</strong> Machine embroidery — polyester thread</p><p><strong>Compliance:</strong> GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan, REACH</p><p><strong>Sourced from:</strong> Bangladesh</p>',
    sizing_note: 'EU sizes shown — US customers should order one size UP',
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
  console.error('  Supabase insert error:', insertErr);
  throw insertErr;
}
console.log(`  OK: Product ${productId}`);

// ─── STEP 7: Create Supabase Variants ───────────────────────────────
console.log('\n=== STEP 7: Create Supabase Variants ===');

const sbVariants = [];
for (const [color, sizes] of Object.entries(VARIANTS)) {
  for (const [size, variantId] of Object.entries(sizes)) {
    const priceCents = parseInt(PRICES[size].replace('.', ''));
    sbVariants.push({
      product_id: productId,
      title: `Recycled '26 / ${color} / ${size}`,
      color,
      color_hex: COLOR_HEX[color],
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
  console.error('  Variants insert error:', varErr);
} else {
  console.log(`  OK: ${sbVariants.length} variants created`);
}

// ─── STEP 8: Publish on Printful ─────────────────────────────────────
console.log('\n=== STEP 8: Publish ===');
await delay(3000);

try {
  await pf(`/store/products/${pfProductId}/publish.json`, {
    method: 'POST',
    body: '{}',
  });
  console.log('  OK: Publish requested');
} catch (e) {
  console.log('  WARN: Publish skipped:', e.message);
}

await delay(3000);

try {
  await pf(`/store/products/${pfProductId}/publishing_succeeded.json`, {
    method: 'POST',
    body: JSON.stringify({ external: { id: productId } }),
  });
  console.log('  OK: Publishing confirmed with Supabase ID');
} catch (e) {
  console.log('  WARN: Publishing confirmation skipped:', e.message);
}

// ─── STEP 9: Generate Ghost Mockups ──────────────────────────────────
console.log('\n=== STEP 9: Generate Ghost Mockups ===');

const MOCKUP_VARIANTS = { 'Desert Dust': 12384 }; // L variant for mockups

for (const [color, variantId] of Object.entries(MOCKUP_VARIANTS)) {
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
        console.error(`  Mockup failed for ${color}:`, poll.result.error);
        break;
      }
      console.log(`  Polling... (${poll.result.status})`);
    }

    if (mockups) {
      console.log(`  OK: ${color}: ${mockups.length} mockup views generated`);
      for (const m of mockups) {
        console.log(`    - ${m.placement || 'view'}: ${m.mockup_url?.substring(0, 80)}...`);
      }

      // Download and upload to Supabase Storage
      for (let idx = 0; idx < mockups.length; idx++) {
        const m = mockups[idx];
        const viewName = m.placement || `view-${idx}`;
        const fileName = `recycled-26/${color.toLowerCase().replace(' ', '-')}-${viewName}.png`;

        try {
          const imgRes = await fetch(m.mockup_url);
          const imgBuf = Buffer.from(await imgRes.arrayBuffer());

          await supabase.storage.from('designs').upload(
            `mockups/${fileName}`,
            imgBuf,
            { contentType: 'image/png', upsert: true }
          );
          console.log(`    OK: mockups/${fileName}`);
        } catch (uploadErr) {
          console.log(`    WARN: Upload failed for ${viewName}:`, uploadErr.message);
        }
      }
    }
  } catch (e) {
    console.log(`  WARN: Mockup generation failed for ${color}:`, e.message);
    console.log('    (Embroidery mockups may not be supported)');
  }
}

// ─── STEP 10: Update Supabase Images ─────────────────────────────────
console.log('\n=== STEP 10: Update Supabase Product Images ===');

const { data: mockupFiles } = await supabase.storage.from('designs').list('mockups/recycled-26');
const images = [];

if (mockupFiles && mockupFiles.length > 0) {
  for (const f of mockupFiles) {
    const src = `${SB_URL}/storage/v1/object/public/designs/mockups/recycled-26/${f.name}?v=${Date.now()}`;
    images.push({
      src,
      alt: `Recycled '26 — Desert Dust`,
    });
  }
}

if (images.length > 0) {
  const { error: imgErr } = await supabase.from('products').update({ images }).eq('id', productId);
  if (imgErr) console.error('  Image update error:', imgErr);
  else console.log(`  OK: Updated with ${images.length} mockup images`);
} else {
  console.log('  No mockup images available — add manually from Printful Dashboard');
}

// ─── SUMMARY ─────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log("  SKAPARA RECYCLED '26 — CREATION COMPLETE");
console.log('='.repeat(60));
console.log(`  Printful Product ID: ${pfProductId}`);
console.log(`  Supabase Product ID: ${productId}`);
console.log(`  Variants: ${sbVariants.length} (Desert Dust x 5 sizes)`);
console.log(`  Placements: 2 embroidery (chest_left + wrist_right)`);
console.log(`  Pricing: EUR 74.99 (S-XL), EUR 79.99 (2XL)`);
console.log(`  Provider: Printful, EU Latvia`);
console.log('='.repeat(60));

console.log('\nNEXT STEPS:');
console.log('  1. Verify product in Printful Dashboard');
console.log('  2. Check GPSR is accepted');
console.log('  3. If mockups failed, download from Printful Dashboard');
console.log('  4. Run cron sync: GET /api/cron/sync-printify');
