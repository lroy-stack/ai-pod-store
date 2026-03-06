#!/usr/bin/env node
/**
 * Create Trendi DTG Hoodie on Printful
 * Cotton Heritage M2580 (catalog 380) — DTG technique
 * Black + White, EU Latvia fulfillment
 * 4 placements: front (chest-left brandname), back (maximalist design),
 *               sleeve_left (S mark), sleeve_right (geometric pattern)
 */

import { readFileSync } from 'fs';
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
const PRODUCT_SLUG = 'trendi';
const PRODUCT_TITLE = 'Trendi';

const VARIANTS = {
  Black: { hex: '#080808', ids: { S: 10779, M: 10780, L: 10781, XL: 10782, '2XL': 10783, '3XL': 13416 } },
  White: { hex: '#ffffff', ids: { S: 10774, M: 10775, L: 10776, XL: 10777, '2XL': 10778, '3XL': 13421 } },
};

const PRICES = {
  S: '59.99', M: '59.99', L: '59.99', XL: '59.99', '2XL': '64.99', '3XL': '69.99',
};

const PLACEMENTS = [
  { key: 'default',       file: 'front.png',        w: 1800, h: 1800 },
  { key: 'back',          file: 'back.png',         w: 1800, h: 2400 },
  { key: 'sleeve_left',   file: 'sleeve-left.png',  w: 450,  h: 1800 },
  { key: 'sleeve_right',  file: 'sleeve-right.png', w: 450,  h: 1800 },
];

const DESCRIPTIONS = {
  en: "Maximum expression, zero subtlety. Trendi is a retro-cyberpunk collision of SKAPARA's S mark, constructivist geometry, and the checkerboard patterns of street culture — from the bold back panel to branded sleeves. Premium heavyweight cotton, four-point DTG printing.",
  es: "Expresion maxima, sutileza cero. Trendi es una colision retro-cyberpunk del isotipo S de SKAPARA, geometria constructivista y patrones de tablero de la cultura callejera — desde el panel trasero hasta las mangas con branding. Algodon premium de gramaje alto, impresion DTG en cuatro puntos.",
  de: "Maximaler Ausdruck, null Subtilitat. Trendi ist eine retro-cyberpunk Kollision aus SKAPARAs S-Mark, konstruktivistischer Geometrie und Schachbrettmustern der Strassenkultur — vom Ruckenpanel bis zu gebrandeten Armeln. Premium-Baumwolle, Vier-Punkt DTG-Druck.",
};

const PNG_DIR = new URL('../public/brand-designs/trendi/', import.meta.url).pathname;

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
  if (res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset');
    const waitSec = reset ? parseInt(reset) : 30;
    console.log(`  ⏳ Rate limited, waiting ${waitSec}s...`);
    await delay(waitSec * 1000);
    return pf(path, opts);
  }
  const json = await res.json();
  if (!res.ok) {
    console.error(`  ❌ Printful ${res.status} ${path}:`, JSON.stringify(json).substring(0, 300));
    throw new Error(`Printful API error: ${res.status}`);
  }
  return json;
}

// ─── STEPS 1-3 ALREADY COMPLETED ─────────────────────────────────────
// Files uploaded to Supabase + Printful, product created on Printful
const pfProductId = 422183431;

const fileIds = {
  default: 950766641,
  back: 950766655,
  sleeve_left: 950766672,
  sleeve_right: 950766696,
};

const supabaseUrls = {};
for (const p of PLACEMENTS) {
  supabaseUrls[p.key] = `${SB_URL}/storage/v1/object/public/designs/dtg-sources/trendi/${p.file}`;
}

console.log(`\n  Using existing Printful product: ${pfProductId}`);
console.log('  File IDs:', JSON.stringify(fileIds));

// ─── STEP 4: GPSR (EU Regulation 2023/988) ──────────────────────────
console.log('\n═══ STEP 4: GPSR Safety Information ═══');
await delay(3000);

try {
  const gpsrTemplate = await pf(`/store/products/${pfProductId}/gpsr`);
  console.log('  GPSR template retrieved');

  await delay(2000);
  await pf(`/store/products/${pfProductId}/gpsr`, {
    method: 'PUT',
    body: JSON.stringify({
      safety_information: gpsrTemplate.result?.safety_information || '',
    }),
  });
  console.log('  ✓ GPSR accepted');
} catch (e) {
  console.log('  ⚠ GPSR step skipped:', e.message);
}

// ─── STEP 5: Create Supabase Product ────────────────────────────────
console.log('\n═══ STEP 5: Create Supabase Product ═══');

const productId = crypto.randomUUID();
const now = new Date().toISOString();

const { error: insertErr } = await supabase.from('products').insert({
  id: productId,
  title: PRODUCT_TITLE,
  description: DESCRIPTIONS.en,
  category: 'pullover-hoodies',
  tags: ['dtg', 'premium', 'maximalist', 'skapara', '2026', 'retro', 'cyberpunk'],
  base_price_cents: 5999,
  currency: 'EUR',
  images: [],
  status: 'active',
  translations: {
    es: { title: PRODUCT_TITLE, description: DESCRIPTIONS.es },
    de: { title: PRODUCT_TITLE, description: DESCRIPTIONS.de },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'Cotton Heritage M2580',
    tier: 'PREMIUM',
    material: '100% cotton face / 65% ring-spun cotton, 35% polyester, 8.5 oz/yd²',
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach. Iron on low heat, avoid print area.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'LV',
    provider_name: 'Printful',
    fit: 'Classic Streetwear / Pullover Hoodie',
    sizing_note: 'Runs small — recommend ordering one size up',
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p><p><strong>Material:</strong> 100% cotton face / 65% ring-spun cotton, 35% polyester</p><p><strong>Weight:</strong> 8.5 oz/yd²</p><p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>',
    dtg_placements: 4,
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
for (const [color, { hex, ids }] of Object.entries(VARIANTS)) {
  for (const [size, variantId] of Object.entries(ids)) {
    const priceCents = parseInt(PRICES[size].replace('.', ''));
    sbVariants.push({
      product_id: productId,
      color,
      color_hex: hex,
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

// ─── STEP 7: Publish on Printful ────────────────────────────────────
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

// ─── STEP 8: Generate Ghost Mockups ─────────────────────────────────
console.log('\n═══ STEP 8: Generate Ghost Mockups ═══');

// Design-first analysis:
// Design has Green #01784E, Yellow #FFCC00, Black #000000, White #FFFFFF background
// On BLACK garment: white bg panel stands out, colored elements pop, black elements blend → OK
// On WHITE garment: white bg blends, colored elements visible, gives clean look → OK
const MOCKUP_COLORS = {
  Black: 10781,  // L variant
  White: 10776,  // L variant
};

// Build mockup files config — front, back, sleeve_left (no sleeve_right in mockup views)
const mockupFiles = PLACEMENTS.filter(p => p.key !== 'sleeve_right').map(p => ({
  placement: p.key === 'default' ? 'front' : p.key,
  image_url: supabaseUrls[p.key],
  position: {
    area_width: p.w,
    area_height: p.h,
    width: p.w,
    height: p.h,
    top: 0,
    left: 0,
  },
}));

const allMockupImages = [];

for (const [color, variantId] of Object.entries(MOCKUP_COLORS)) {
  const colorSlug = color.toLowerCase().replace(/\s+/g, '-');
  console.log(`\n  Generating mockup for ${color}...`);
  await delay(10000);

  try {
    // M2580: do NOT include option_groups or options
    const taskResult = await pf(`/mockup-generator/create-task/${CATALOG_ID}`, {
      method: 'POST',
      body: JSON.stringify({
        variant_ids: [variantId],
        format: 'png',
        width: 1000,
        files: mockupFiles,
      }),
    });

    const taskKey = taskResult.result.task_key;
    console.log(`  Task created: ${taskKey}`);

    // Poll for completion
    let mockups = null;
    for (let i = 0; i < 30; i++) {
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

    if (mockups && mockups.length > 0) {
      // Extract from first mockup object (avoid duplicate bug)
      const m = mockups[0];
      console.log(`  ✓ ${color}: mockup_url + ${m.extra?.length || 0} extra views`);

      // Front view
      const frontFile = `mockups/${PRODUCT_SLUG}/${colorSlug}-front.png`;
      allMockupImages.push({
        url: m.mockup_url,
        storagePath: frontFile,
        alt: `${PRODUCT_TITLE} - ${color}`,
      });

      // Back and Left views from extra[]
      for (const extra of m.extra || []) {
        const view = extra.title.toLowerCase();
        const filePath = `mockups/${PRODUCT_SLUG}/${colorSlug}-${view}.png`;
        const altSuffix = view === 'back' ? 'Back' : 'Sleeve';
        allMockupImages.push({
          url: extra.url,
          storagePath: filePath,
          alt: `${PRODUCT_TITLE} - ${color} - ${altSuffix}`,
        });
      }
    } else {
      console.log(`  ⚠ No mockups returned for ${color}`);
    }
  } catch (e) {
    console.log(`  ⚠ Mockup generation failed for ${color}:`, e.message);
  }
}

// Download and upload all mockups to Supabase Storage
console.log(`\n  Downloading and uploading ${allMockupImages.length} mockup images...`);

for (const img of allMockupImages) {
  try {
    await delay(1000);
    const imgRes = await fetch(img.url);
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());

    await supabase.storage.from('designs').upload(
      img.storagePath,
      imgBuf,
      { contentType: 'image/png', upsert: true }
    );
    console.log(`    ✓ ${img.storagePath}`);
  } catch (uploadErr) {
    console.log(`    ⚠ Upload failed for ${img.storagePath}:`, uploadErr.message);
  }
}

// ─── STEP 9: Update Supabase Product Images ─────────────────────────
console.log('\n═══ STEP 9: Update Supabase Product Images ═══');

const ts = Date.now();
const images = [];

// Order: Fronts first, then Backs, then Sleeves (per MOCKUPS.md convention)
const fronts = allMockupImages.filter(i => i.storagePath.includes('-front.'));
const backs = allMockupImages.filter(i => i.storagePath.includes('-back.'));
const sleeves = allMockupImages.filter(i => !i.storagePath.includes('-front.') && !i.storagePath.includes('-back.'));

for (const group of [fronts, backs, sleeves]) {
  for (const img of group) {
    images.push({
      src: `${SB_URL}/storage/v1/object/public/designs/${img.storagePath}?v=${ts}`,
      alt: img.alt,
    });
  }
}

if (images.length > 0) {
  const { error: imgErr } = await supabase.from('products').update({ images }).eq('id', productId);
  if (imgErr) console.error('  ❌ Image update error:', imgErr);
  else console.log(`  ✓ Updated with ${images.length} mockup images`);
} else {
  console.log('  ⚠ No mockup images — product created without images');
}

// Update variant image_url for color toggle
for (const [color, { ids }] of Object.entries(VARIANTS)) {
  const colorSlug = color.toLowerCase().replace(/\s+/g, '-');
  const frontImg = fronts.find(f => f.storagePath.includes(`${colorSlug}-front`));
  if (frontImg) {
    const imageUrl = `${SB_URL}/storage/v1/object/public/designs/${frontImg.storagePath}?v=${ts}`;
    const { error: vuErr } = await supabase
      .from('product_variants')
      .update({ image_url: imageUrl })
      .eq('product_id', productId)
      .eq('color', color);
    if (vuErr) console.error(`  ❌ Variant image update error for ${color}:`, vuErr);
    else console.log(`  ✓ ${color} variant image_url updated`);
  }
}

// ─── SUMMARY ─────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log(`  ${PRODUCT_TITLE.toUpperCase()} DTG HOODIE — CREATION COMPLETE`);
console.log('═'.repeat(60));
console.log(`  Printful Product ID: ${pfProductId}`);
console.log(`  Supabase Product ID: ${productId}`);
console.log(`  Variants: ${sbVariants.length} (Black + White × 6 sizes)`);
console.log(`  Placements: 4 DTG (front, back, sleeve_left, sleeve_right)`);
console.log(`  Mockups: ${allMockupImages.length} (${Object.keys(MOCKUP_COLORS).join(' + ')} × views)`);
console.log(`  Pricing: €59.99 (S-XL), €64.99 (2XL), €69.99 (3XL)`);
console.log(`  Provider: Printful, EU Latvia`);
console.log('═'.repeat(60));
