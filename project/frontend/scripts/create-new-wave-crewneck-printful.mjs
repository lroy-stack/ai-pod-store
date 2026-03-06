#!/usr/bin/env node
/**
 * SKAPARA New Wave Crewneck — Full Production Pipeline
 * Model: Cotton Heritage M2480 (Catalog 411) PREMIUM Crewneck
 * Provider: Printful Latvia (EU)
 * Placements: back (hero), front/default (chest S mark), sleeve_left (SKAPARA multicolor)
 * Colors: Black, Navy Blazer, Charcoal Heather, Vintage Black (4 dark EU)
 * Sizes: S–3XL (6 per color = 24 variants)
 *
 * Steps:
 *  1. Render design PNGs from SVGs
 *  2. Upload designs to Supabase Storage
 *  3. Upload designs to Printful File Library
 *  4. Create Printful sync product (24 variants)
 *  5. Create Supabase product (with GPSR, translations, product_details)
 *  6. Create Supabase product_variants (24)
 *  7. Generate mockups (Ghost — back + front + sleeve per color)
 *  8. Download + upload mockups to Supabase Storage
 *  9. Update product images
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// ─── ENV ───────────────────────────────────────────────────────────────
const envFile = readFileSync('.env.local', 'utf8');
const env = (key) => {
  const m = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'));
  if (!m) throw new Error(`Missing env: ${key}`);
  return m[1].trim().replace(/^["']|["']$/g, '');
};

const PF_TOKEN = env('PRINTFUL_API_TOKEN');
const PF_STORE = env('PRINTFUL_STORE_ID');
const SB_URL   = env('NEXT_PUBLIC_SUPABASE_URL');
const SB_KEY   = env('SUPABASE_SERVICE_KEY');

const supabase = createClient(SB_URL, SB_KEY);
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const pfHeaders = {
  'Authorization': `Bearer ${PF_TOKEN}`,
  'X-PF-Store-Id': PF_STORE,
  'Content-Type': 'application/json',
  'User-Agent': 'POD-AI-Store/1.0'
};

async function pfFetch(path, opts = {}) {
  const url = `https://api.printful.com${path}`;
  const res = await fetch(url, { headers: pfHeaders, ...opts });
  const json = await res.json();
  if (!res.ok) {
    console.error(`Printful ${res.status}:`, JSON.stringify(json, null, 2));
    throw new Error(`Printful API error: ${res.status}`);
  }
  return json;
}

// ─── PRODUCT CONFIG ────────────────────────────────────────────────────
// RESUME MODE: Steps 1-4 already completed. Use fixed IDs.
const RESUME = process.argv.includes('--resume');
const PRODUCT_ID = RESUME ? 'ebdaf049-3f59-49d8-85b7-09bc179ebb17' : randomUUID();
const RESUME_PF_PRODUCT_ID = 422280654;
const RESUME_FILE_IDS = { back: 951045989, chest: 951045995, sleeve: 951046003 };
const SLUG = 'new-wave-crewneck';
const CATALOG_ID = 411;
const CATEGORY_ID = '3213a34b-0eeb-4195-8531-29e65f442384'; // crewnecks

const COLORS = [
  { name: 'Black',             hex: '#101010', slug: 'black' },
  { name: 'Navy Blazer',       hex: '#171f2c', slug: 'navy-blazer' },
  { name: 'Charcoal Heather',  hex: '#3a3a38', slug: 'charcoal-heather' },
  { name: 'Vintage Black',     hex: '#43413D', slug: 'vintage-black' },
];

const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

// Variant IDs per color per size [S, M, L, XL, 2XL, 3XL]
const VARIANT_IDS = {
  'Black':             [11254, 11255, 11256, 11257, 11258, 13258],
  'Navy Blazer':       [13252, 13253, 13254, 13255, 13256, 13257],
  'Charcoal Heather':  [11259, 11260, 11261, 11262, 11263, 13260],
  'Vintage Black':     [20363, 20362, 20361, 20360, 20359, 20358],
};

// Pricing: €64.99 S-XL, €69.99 2XL-3XL (PREMIUM exclusive)
const PRICES = {
  'S': '64.99', 'M': '64.99', 'L': '64.99', 'XL': '64.99',
  '2XL': '69.99', '3XL': '69.99'
};

const BASE_PRICE_CENTS = 6499;

// ─── DESIGN FILE PATHS ────────────────────────────────────────────────
const DESIGNS_DIR = 'public/brand-designs/new-wave';
const BACK_SVG    = `${DESIGNS_DIR}/back-new-wave.svg`;
const CHEST_PNG   = '/tmp/chest-smark-right.png';  // already rendered
const SLEEVE_PNG  = '/tmp/sleeve-multicolor.png';   // already rendered

// ─── STEP 1: RENDER BACK DESIGN PNG ───────────────────────────────────
async function step1_renderDesigns() {
  console.log('\n═══ STEP 1: Render design PNGs ═══');

  // Back design from SVG (chest + sleeve already rendered)
  console.log('  Rendering back design from SVG...');
  execSync(`magick -density 150 -background transparent "${BACK_SVG}" -resize 1800x2400! PNG32:/tmp/new-wave-back-final.png`);
  console.log('  ✓ Back: /tmp/new-wave-back-final.png (1800x2400)');

  // Verify chest and sleeve exist
  const chestInfo = execSync(`identify ${CHEST_PNG}`).toString().trim();
  const sleeveInfo = execSync(`identify ${SLEEVE_PNG}`).toString().trim();
  console.log(`  ✓ Chest: ${chestInfo}`);
  console.log(`  ✓ Sleeve: ${sleeveInfo}`);
}

// ─── STEP 2: UPLOAD TO SUPABASE STORAGE ───────────────────────────────
async function step2_uploadSupabase() {
  console.log('\n═══ STEP 2: Upload designs to Supabase Storage ═══');
  const uploads = [
    { local: '/tmp/new-wave-back-final.png', remote: `designs/${SLUG}/back-1800x2400.png` },
    { local: CHEST_PNG,                       remote: `designs/${SLUG}/chest-right-1800x2400.png` },
    { local: SLEEVE_PNG,                      remote: `designs/${SLUG}/sleeve-multicolor-450x1800.png` },
  ];

  const urls = {};
  for (const { local, remote } of uploads) {
    const file = readFileSync(local);
    const { error } = await supabase.storage.from('designs').upload(remote, file, {
      contentType: 'image/png', upsert: true
    });
    if (error) console.error(`  ✗ ${remote}:`, error.message);
    else console.log(`  ✓ ${remote}`);

    const { data } = supabase.storage.from('designs').getPublicUrl(remote);
    urls[remote.split('/').pop()] = data.publicUrl;
  }

  return urls;
}

// ─── STEP 3: UPLOAD TO PRINTFUL FILE LIBRARY ──────────────────────────
async function step3_uploadPrintful(supabaseUrls) {
  console.log('\n═══ STEP 3: Upload designs to Printful File Library ═══');
  const fileIds = {};

  const files = [
    { key: 'back',    url: supabaseUrls['back-1800x2400.png'],              name: 'new-wave-back-1800x2400.png' },
    { key: 'chest',   url: supabaseUrls['chest-right-1800x2400.png'],       name: 'new-wave-chest-right-1800x2400.png' },
    { key: 'sleeve',  url: supabaseUrls['sleeve-multicolor-450x1800.png'],  name: 'new-wave-sleeve-multicolor-450x1800.png' },
  ];

  for (const { key, url, name } of files) {
    console.log(`  Uploading ${key}...`);
    const res = await pfFetch('/files', {
      method: 'POST',
      body: JSON.stringify({ url, filename: name })
    });
    fileIds[key] = res.result.id;
    console.log(`  ✓ ${key}: file_id=${res.result.id}`);
    await delay(3000);
  }

  return fileIds;
}

// ─── STEP 4: CREATE PRINTFUL SYNC PRODUCT ─────────────────────────────
async function step4_createProduct(fileIds) {
  console.log('\n═══ STEP 4: Create Printful sync product ═══');

  const syncVariants = [];
  for (const color of COLORS) {
    const ids = VARIANT_IDS[color.name];
    for (let i = 0; i < SIZES.length; i++) {
      syncVariants.push({
        variant_id: ids[i],
        retail_price: PRICES[SIZES[i]],
        is_enabled: true,
        files: [
          { type: 'back',        id: fileIds.back },
          { type: 'default',     id: fileIds.chest },
          { type: 'sleeve_left', id: fileIds.sleeve },
        ]
      });
    }
  }

  console.log(`  Creating product with ${syncVariants.length} variants...`);
  const res = await pfFetch('/store/products', {
    method: 'POST',
    body: JSON.stringify({
      sync_product: {
        name: 'New Wave Crewneck — SKAPARA',
        thumbnail: null
      },
      sync_variants: syncVariants
    })
  });

  const pfProductId = res.result.id;
  console.log(`  ✓ Printful sync product ID: ${pfProductId}`);
  return pfProductId;
}

// ─── STEP 5: CREATE SUPABASE PRODUCT ──────────────────────────────────
async function step5_createSupabaseProduct() {
  console.log('\n═══ STEP 5: Create Supabase product ═══');

  const product = {
    id: PRODUCT_ID,
    title: 'New Wave Crewneck',
    tags: ['new-wave', 'crewneck', 'premium', 'streetwear', 'dtg', 'exclusive'],
    description: 'Premium heavyweight crewneck featuring the exclusive New Wave poster design. Three-placement DTG printing: bold streetwear graphics on the back, subtle S mark on the chest, and multicolor SKAPARA wordmark running down the sleeve. Push Forward. Stay Ahead.',
    translations: {
      es: {
        title: 'Crewneck New Wave',
        description: 'Crewneck premium de peso pesado con el diseño exclusivo New Wave en la espalda. Impresión DTG en tres posiciones: gráficos streetwear audaces en la espalda, S mark sutil en el pecho, y la marca SKAPARA multicolor descendiendo por la manga. Push Forward. Stay Ahead.'
      },
      de: {
        title: 'New Wave Crewneck',
        description: 'Premium Heavyweight Crewneck mit dem exklusiven New Wave Posterdesign auf dem Rücken. Dreifacher DTG-Druck: markante Streetwear-Grafik auf dem Rücken, dezentes S-Mark auf der Brust und mehrfarbiger SKAPARA-Schriftzug am Ärmel. Push Forward. Stay Ahead.'
      }
    },
    category: 'crewnecks',
    category_id: CATEGORY_ID,
    base_price_cents: BASE_PRICE_CENTS,
    compare_at_price_cents: 8999,
    images: [],  // Updated after mockups
    status: 'active',
    pod_provider: 'printful',
    product_template_id: CATALOG_ID.toString(),
    product_details: {
      safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Iela 35, Ventspils, LV-3601, Latvia</p><p><strong>Contact:</strong> support@printful.com</p><p><strong>Material:</strong> 65% ring-spun cotton, 35% polyester, 8.5 oz/yd² (Charcoal Heather: 55% cotton, 45% polyester)</p><p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100, CPSIA (if applicable)</p><p><strong>Country of Origin:</strong> Latvia, EU</p>',
      material: '65% ring-spun cotton, 35% polyester, 8.5 oz/yd² (Charcoal Heather: 55% cotton, 45% polyester)',
      care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach. Iron on low heat, avoid print area.',
      print_technique: 'DTG (Direct-to-Garment) — 3 placements: back, front chest, sleeve left',
      manufacturing_country: 'Latvia',
      brand: 'SKAPARA',
      model: 'Cotton Heritage M2480',
      tier: 'PREMIUM',
      fit: 'Classic / Ribbed Crew Neck',
      collection: 'New Wave'
    }
  };

  const { error } = await supabase.from('products').upsert(product);
  if (error) { console.error('  ✗ Product insert error:', error); throw error; }
  console.log(`  ✓ Product created: ${PRODUCT_ID}`);
}

// ─── STEP 6: CREATE SUPABASE VARIANTS ─────────────────────────────────
async function step6_createVariants() {
  console.log('\n═══ STEP 6: Create Supabase product_variants ═══');

  const variants = [];
  for (const color of COLORS) {
    const ids = VARIANT_IDS[color.name];
    for (let i = 0; i < SIZES.length; i++) {
      variants.push({
        product_id: PRODUCT_ID,
        title: `${color.name} / ${SIZES[i]}`,
        color: color.name,
        size: SIZES[i],
        is_enabled: true,
        price_cents: parseInt(PRICES[SIZES[i]].replace('.', '')),
        external_variant_id: ids[i].toString(),
      });
    }
  }

  const { error } = await supabase.from('product_variants').insert(variants);
  if (error) { console.error('  ✗ Variants error:', error); throw error; }
  console.log(`  ✓ ${variants.length} variants created`);
}

// ─── STEP 7: GENERATE MOCKUPS ─────────────────────────────────────────
async function step7_generateMockups(pfProductId) {
  console.log('\n═══ STEP 7: Generate Ghost mockups ═══');

  // Get sync variant IDs from Printful
  console.log('  Fetching sync product details...');
  const productData = await pfFetch(`/store/products/${pfProductId}`);
  const syncVariants = productData.result.sync_variants;
  console.log(`  Found ${syncVariants.length} sync variants`);

  const mockupResults = [];

  for (const color of COLORS) {
    // Find one S-size variant for this color
    const colorVariant = syncVariants.find(sv =>
      sv.product?.variant_id === VARIANT_IDS[color.name][0]
    );
    if (!colorVariant) {
      console.log(`  ⚠ No variant found for ${color.name}, trying by name...`);
      // Fallback: match by color name in the variant name
      const byName = syncVariants.find(sv => sv.name?.includes(color.name) && sv.name?.includes(' S'));
      if (!byName) { console.log(`  ✗ Skipping ${color.name}`); continue; }
    }

    const variantId = VARIANT_IDS[color.name][0]; // S size catalog variant

    console.log(`  Generating mockup for ${color.name} (variant ${variantId})...`);

    try {
      // Create mockup task
      const taskRes = await pfFetch(`/mockup-generator/create-task/${pfProductId}`, {
        method: 'POST',
        body: JSON.stringify({
          variant_ids: [variantId],
          format: 'png',
          width: 1000,
          option_groups: ['Ghost'],
          options: ['Front', 'Back', 'Left']
        })
      });

      const taskKey = taskRes.result?.task_key;
      if (!taskKey) {
        console.log(`  ✗ No task_key for ${color.name}:`, JSON.stringify(taskRes));
        continue;
      }

      // Poll for result
      let result = null;
      for (let attempt = 0; attempt < 30; attempt++) {
        await delay(5000);
        const statusRes = await pfFetch(`/mockup-generator/result/${taskKey}`);
        if (statusRes.result?.status === 'completed') {
          result = statusRes.result;
          break;
        }
        if (statusRes.result?.status === 'failed') {
          console.log(`  ✗ Mockup failed for ${color.name}`);
          break;
        }
      }

      if (result?.mockups) {
        mockupResults.push({ color, mockups: result.mockups });
        const placements = result.mockups.map(m => m.placement).join(', ');
        console.log(`  ✓ ${color.name}: ${result.mockups.length} mockups (${placements})`);
      }
    } catch (err) {
      console.error(`  ✗ Error for ${color.name}:`, err.message);
    }

    await delay(10000); // Rate limit between mockup tasks
  }

  return mockupResults;
}

// ─── STEP 8: DOWNLOAD + UPLOAD MOCKUPS ────────────────────────────────
async function step8_uploadMockups(mockupResults) {
  console.log('\n═══ STEP 8: Download + upload mockups to Supabase ═══');

  const mockupUrls = [];

  for (const { color, mockups } of mockupResults) {
    for (const mockup of mockups) {
      const placement = mockup.placement || 'unknown';
      const viewName = placement === 'front' ? 'front'
        : placement === 'back' ? 'back'
        : placement === 'sleeve_left' ? 'sleeve'
        : placement;

      const filename = `${color.slug}-${viewName}.png`;
      const storagePath = `designs/mockups/${SLUG}/${filename}`;

      try {
        // Download from S3 temp URL
        const imgRes = await fetch(mockup.mockup_url);
        if (!imgRes.ok) { console.log(`  ✗ Download failed: ${filename}`); continue; }
        const buffer = Buffer.from(await imgRes.arrayBuffer());

        // Upload to Supabase
        const { error } = await supabase.storage.from('designs').upload(storagePath, buffer, {
          contentType: 'image/png', upsert: true
        });
        if (error) { console.log(`  ✗ Upload failed: ${filename}:`, error.message); continue; }

        const { data } = supabase.storage.from('designs').getPublicUrl(storagePath);
        mockupUrls.push({
          color: color.name,
          slug: color.slug,
          view: viewName,
          url: data.publicUrl,
          alt: viewName === 'sleeve'
            ? `New Wave Crewneck - ${color.name} - Sleeve`
            : `New Wave Crewneck - ${color.name}`
        });
        console.log(`  ✓ ${filename}`);
      } catch (err) {
        console.error(`  ✗ ${filename}:`, err.message);
      }
      await delay(500);
    }
  }

  return mockupUrls;
}

// ─── STEP 9: UPDATE PRODUCT IMAGES ────────────────────────────────────
async function step9_updateImages(mockupUrls) {
  console.log('\n═══ STEP 9: Update product images ═══');

  const ts = Math.floor(Date.now() / 1000);

  // Order: backs first (hero), then fronts, then sleeves
  const backs   = mockupUrls.filter(m => m.view === 'back');
  const fronts  = mockupUrls.filter(m => m.view === 'front');
  const sleeves = mockupUrls.filter(m => m.view === 'sleeve');

  const images = [...backs, ...fronts, ...sleeves].map(m => ({
    src: `${m.url}?v=${ts}`,
    alt: m.alt
  }));

  const { error } = await supabase.from('products').update({ images }).eq('id', PRODUCT_ID);
  if (error) { console.error('  ✗ Image update error:', error); throw error; }
  console.log(`  ✓ Updated with ${images.length} images (${backs.length} back + ${fronts.length} front + ${sleeves.length} sleeve)`);

  // Update variant image_url (back view = hero for color toggles)
  for (const color of COLORS) {
    const backMockup = backs.find(m => m.slug === color.slug);
    if (backMockup) {
      const { error: vErr } = await supabase
        .from('product_variants')
        .update({ image_url: `${backMockup.url}?v=${ts}` })
        .eq('product_id', PRODUCT_ID)
        .eq('color', color.name);
      if (vErr) console.error(`  ✗ Variant image update for ${color.name}:`, vErr);
      else console.log(`  ✓ Variant images for ${color.name} → back mockup`);
    }
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  SKAPARA New Wave Crewneck — Production Pipeline ║');
  console.log('║  M2480 Cat 411 • 4 colors • 24 variants • DTG   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  Product ID: ${PRODUCT_ID}`);

  try {
    let pfProductId;
    if (RESUME) {
      console.log('  ⚡ RESUME MODE — skipping steps 1-4 (already completed)');
      pfProductId = RESUME_PF_PRODUCT_ID;
    } else {
      await step1_renderDesigns();
      const supabaseUrls = await step2_uploadSupabase();
      const fileIds = await step3_uploadPrintful(supabaseUrls);
      pfProductId = await step4_createProduct(fileIds);
    }
    await step5_createSupabaseProduct();
    await step6_createVariants();
    const mockupResults = await step7_generateMockups(pfProductId);
    const mockupUrls = await step8_uploadMockups(mockupResults);
    await step9_updateImages(mockupUrls);

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║  ✓ PIPELINE COMPLETE                              ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`  Supabase Product: ${PRODUCT_ID}`);
    console.log(`  Printful Product: ${pfProductId}`);
    console.log(`  Slug: ${SLUG}`);
    console.log(`  Variants: ${COLORS.length * SIZES.length}`);
    console.log(`  Mockups: ${mockupUrls.length}`);
    console.log(`  Price: €64.99 (S-XL) / €69.99 (2XL-3XL)`);
    console.log('\n  ⚠ Manual: Add label_inside via Printful Dashboard');
    console.log('           Dashboard → Products → Edit → Inside label');

  } catch (err) {
    console.error('\n✗ Pipeline failed:', err.message);
    process.exit(1);
  }
}

main();
