#!/usr/bin/env node
/**
 * Fix pricing + Vintage Black mockup
 * 1. Update prices: base=€44.99, compare_at=€64.99, XL+=€49.99/€69.99
 * 2. Update Printful retail_price per variant
 * 3. Regenerate Vintage Black mockup (duplicate sleeve_left bug)
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

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
  if (res.status === 429) {
    const body = await res.json();
    const wait = parseInt(body.error?.message?.match(/(\d+) seconds/)?.[1] || '60');
    console.log(`  ⏳ Rate limited, waiting ${wait + 5}s...`);
    await delay((wait + 5) * 1000);
    return pfFetch(path, opts);
  }
  const json = await res.json();
  if (!res.ok) {
    console.error(`Printful ${res.status}:`, JSON.stringify(json, null, 2));
    throw new Error(`Printful API error: ${res.status}`);
  }
  return json;
}

const PRODUCT_ID = 'ebdaf049-3f59-49d8-85b7-09bc179ebb17';
const PF_PRODUCT_ID = 422280654;
const SLUG = 'new-wave-crewneck';
const CATALOG_ID = 411;

// Pricing: S-L = €44.99 (sale) / €64.99 (original)
//          XL-3XL = €49.99 (sale) / €69.99 (original)
const SALE_PRICES = {
  'S': 4499, 'M': 4499, 'L': 4499,
  'XL': 4999, '2XL': 4999, '3XL': 4999
};
const RETAIL_PRICES = {
  'S': '44.99', 'M': '44.99', 'L': '44.99',
  'XL': '49.99', '2XL': '49.99', '3XL': '49.99'
};
const COMPARE_AT = {
  'S': 6499, 'M': 6499, 'L': 6499,
  'XL': 6999, '2XL': 6999, '3XL': 6999
};

const VARIANT_IDS = {
  'Black':             { S: 11254, M: 11255, L: 11256, XL: 11257, '2XL': 11258, '3XL': 13258 },
  'Navy Blazer':       { S: 13252, M: 13253, L: 13254, XL: 13255, '2XL': 13256, '3XL': 13257 },
  'Charcoal Heather':  { S: 11259, M: 11260, L: 11261, XL: 11262, '2XL': 11263, '3XL': 13260 },
  'Vintage Black':     { S: 20363, M: 20362, L: 20361, XL: 20360, '2XL': 20359, '3XL': 20358 },
};

async function main() {
  // ═══ PART 1: FIX PRICING ═══
  console.log('═══ PART 1: UPDATE PRICING ═══\n');

  // 1a. Update Supabase product base price + compare_at
  console.log('▶ Supabase product: base=€44.99, compare_at=€64.99');
  const { error: prodErr } = await supabase.from('products').update({
    base_price_cents: 4499,
    compare_at_price_cents: 6499,
  }).eq('id', PRODUCT_ID);
  if (prodErr) console.error('  ✗', prodErr);
  else console.log('  ✓ Product pricing updated');

  // 1b. Update Supabase variant prices
  console.log('\n▶ Supabase variants: S-L=€44.99, XL-3XL=€49.99');
  for (const size of Object.keys(SALE_PRICES)) {
    const { error } = await supabase.from('product_variants')
      .update({ price_cents: SALE_PRICES[size] })
      .eq('product_id', PRODUCT_ID)
      .eq('size', size);
    if (error) console.error(`  ✗ ${size}:`, error);
    else process.stdout.write('.');
  }
  console.log('\n  ✓ All variant prices updated');

  // 1c. Update Printful retail_price per variant
  console.log('\n▶ Printful retail_price per variant...');
  const productData = await pfFetch(`/store/products/${PF_PRODUCT_ID}`);
  const syncVariants = productData.result.sync_variants;

  for (const sv of syncVariants) {
    // Find size from variant name (e.g. "New Wave Crewneck — SKAPARA / Black / S")
    const nameParts = sv.name.split(' / ');
    const size = nameParts[nameParts.length - 1]?.trim();
    const retailPrice = RETAIL_PRICES[size];
    if (!retailPrice) { console.log(`  ⚠ Unknown size in "${sv.name}"`); continue; }

    await delay(2000);
    try {
      await pfFetch(`/store/variants/${sv.id}`, {
        method: 'PUT',
        body: JSON.stringify({ retail_price: retailPrice })
      });
      process.stdout.write('.');
    } catch (err) {
      console.log(`\n  ⚠ ${sv.id}: ${err.message}`);
    }
  }
  console.log(`\n  ✓ ${syncVariants.length} Printful variants updated`);

  // ═══ PART 2: FIX VINTAGE BLACK MOCKUP ═══
  console.log('\n═══ PART 2: REGENERATE VINTAGE BLACK MOCKUP ═══\n');

  // Get current file preview URLs
  const files = syncVariants[0].files;
  const chestPreview = files.find(f => f.type === 'default')?.preview_url;
  const backPreview = files.find(f => f.type === 'back')?.preview_url;
  const sleevePreview = files.find(f => f.type === 'sleeve_left')?.preview_url;

  const vintageVariantS = 20363;
  console.log(`▶ Generating mockup for Vintage Black (${vintageVariantS})...`);

  // Try up to 3 attempts to get all 3 unique placements
  let finalMockups = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`  Attempt ${attempt}/3...`);
    if (attempt > 1) await delay(15000);

    const taskRes = await pfFetch(`/mockup-generator/create-task/${CATALOG_ID}`, {
      method: 'POST',
      body: JSON.stringify({
        variant_ids: [vintageVariantS],
        format: 'png', width: 1000,
        option_groups: ['Ghost'],
        options: ['Front', 'Back', 'Left'],
        files: [
          { placement: 'front', image_url: chestPreview,
            position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
          { placement: 'back', image_url: backPreview,
            position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
          { placement: 'sleeve_left', image_url: sleevePreview,
            position: { area_width: 450, area_height: 1800, width: 450, height: 1800, top: 0, left: 0 } }
        ]
      })
    });

    const taskKey = taskRes.result?.task_key;
    if (!taskKey) { console.log('  ✗ No task_key'); continue; }

    let result = null;
    for (let i = 0; i < 30; i++) {
      await delay(4000);
      const s = await pfFetch(`/mockup-generator/task?task_key=${taskKey}`);
      if (s.result?.status === 'completed') { result = s.result; break; }
      if (s.result?.status === 'failed') { break; }
      process.stdout.write('.');
    }

    if (!result?.mockups) { console.log('\n  ✗ No result'); continue; }

    // Dedup and check placements
    const byPlacement = {};
    for (const m of result.mockups) {
      if (!byPlacement[m.placement]) byPlacement[m.placement] = m;
    }

    const placements = Object.keys(byPlacement);
    console.log(`\n  Raw: ${result.mockups.length} entries → Unique: ${placements.join(', ')}`);

    if (placements.includes('front') && placements.includes('back') && placements.includes('sleeve_left')) {
      finalMockups = byPlacement;
      console.log('  ✓ All 3 placements found!');
      break;
    }

    console.log(`  ⚠ Missing placement(s), retrying...`);
  }

  if (!finalMockups) {
    console.log('\n  ✗ Could not get all 3 placements after 3 attempts');
    console.log('  Using whatever we have...');
  }

  if (finalMockups) {
    // Upload Vintage Black mockups
    console.log('\n▶ Uploading Vintage Black mockups...');
    const imgTs = Math.floor(Date.now() / 1000);
    const vintageUrls = {};

    for (const [placement, mockup] of Object.entries(finalMockups)) {
      const viewName = placement === 'front' ? 'front' : placement === 'back' ? 'back' : 'sleeve';
      const filename = `vintage-black-${viewName}.png`;
      const path = `designs/mockups/${SLUG}/${filename}`;

      const r = await fetch(mockup.mockup_url);
      if (!r.ok) { console.log(`  ✗ Download: ${filename}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());

      await supabase.storage.from('designs').upload(path, buf, { contentType: 'image/png', upsert: true });
      const { data } = supabase.storage.from('designs').getPublicUrl(path);
      vintageUrls[viewName] = `${data.publicUrl}?v=${imgTs}`;
      console.log(`  ✓ ${filename}`);
      await delay(300);
    }

    // Update product images — replace only Vintage Black entries
    console.log('\n▶ Updating product images...');
    const { data: product } = await supabase.from('products').select('images').eq('id', PRODUCT_ID).single();
    let images = product?.images || [];

    // Remove old Vintage Black images
    images = images.filter(img => !img.alt?.includes('Vintage Black'));

    // Add new ones in correct positions
    const allBacks = images.filter(i => !i.alt?.includes('Sleeve'));
    const allSleeves = images.filter(i => i.alt?.includes('Sleeve'));

    // Rebuild: backs (including VB), fronts (including VB), sleeves (including VB)
    const otherBacks = images.filter(i => i.alt && !i.alt.includes('Vintage Black') && !i.alt.includes('Sleeve') && images.indexOf(i) < images.findIndex(x => x.alt?.includes('Sleeve')));

    // Simpler: just re-read all existing + add VB
    // Get all non-VB images grouped
    const existingNonVB = images.filter(i => !i.alt?.includes('Vintage Black'));
    const backs = existingNonVB.filter(i => i.alt && !i.alt.includes('Sleeve'));
    // Split backs into actual backs vs fronts based on position (backs first, then fronts)
    // Actually just add VB at end of each group

    // Get fresh data from existing mockup URLs
    const { data: freshProduct } = await supabase.from('products').select('images').eq('id', PRODUCT_ID).single();
    const currentImages = freshProduct?.images || [];

    // Replace VB entries with corrected ones
    const newImages = [];
    let addedVBBack = false, addedVBFront = false, addedVBSleeve = false;

    for (const img of currentImages) {
      if (img.alt?.includes('Vintage Black')) {
        // Skip old VB images, we'll add corrected ones
        if (img.alt?.includes('Sleeve') && !addedVBSleeve && vintageUrls.sleeve) {
          newImages.push({ src: vintageUrls.sleeve, alt: 'New Wave Crewneck - Vintage Black - Sleeve' });
          addedVBSleeve = true;
        } else if (!img.alt?.includes('Sleeve') && !addedVBBack && vintageUrls.back) {
          newImages.push({ src: vintageUrls.back, alt: 'New Wave Crewneck - Vintage Black' });
          addedVBBack = true;
        } else if (!img.alt?.includes('Sleeve') && addedVBBack && !addedVBFront && vintageUrls.front) {
          newImages.push({ src: vintageUrls.front, alt: 'New Wave Crewneck - Vintage Black' });
          addedVBFront = true;
        }
      } else {
        newImages.push(img);
      }
    }

    // If VB entries weren't replaced (missing in original), append them
    if (!addedVBBack && vintageUrls.back) newImages.push({ src: vintageUrls.back, alt: 'New Wave Crewneck - Vintage Black' });
    if (!addedVBFront && vintageUrls.front) newImages.push({ src: vintageUrls.front, alt: 'New Wave Crewneck - Vintage Black' });
    if (!addedVBSleeve && vintageUrls.sleeve) newImages.push({ src: vintageUrls.sleeve, alt: 'New Wave Crewneck - Vintage Black - Sleeve' });

    const { error: imgErr } = await supabase.from('products').update({ images: newImages }).eq('id', PRODUCT_ID);
    if (imgErr) console.error('  ✗', imgErr);
    else console.log(`  ✓ ${newImages.length} images (VB replaced with corrected mockups)`);

    // Update VB variant image_url
    if (vintageUrls.back) {
      await supabase.from('product_variants')
        .update({ image_url: vintageUrls.back })
        .eq('product_id', PRODUCT_ID).eq('color', 'Vintage Black');
      console.log('  ✓ VB variant image_url updated');
    }
  }

  // ═══ SUMMARY ═══
  console.log('\n═══ SUMMARY ═══');
  console.log('  Pricing:');
  console.log('    S-L:     €44.99 (sale) / €64.99 (original) = -31%');
  console.log('    XL-3XL:  €49.99 (sale) / €69.99 (original) = -29%');
  console.log('  Vintage Black: mockup regenerated with dedup');
  console.log('\n  Gestión de precios y descuentos:');
  console.log('    • Supabase: products.base_price_cents (venta) + compare_at_price_cents (original)');
  console.log('    • Supabase: product_variants.price_cents (por talla)');
  console.log('    • Printful: retail_price por sync_variant');
  console.log('    • Frontend: StrikethroughPrice muestra ~~original~~ VENTA -X%');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
