#!/usr/bin/env node
/**
 * Fix New Wave Crewneck — Re-upload corrected designs + regenerate mockups
 * Fixes: 1) Removed stray lines from back SVG 2) Fixed sleeve transparency 3) Vintage Black dedup
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

const COLORS = [
  { name: 'Black',             slug: 'black',             variantS: 11254 },
  { name: 'Navy Blazer',       slug: 'navy-blazer',       variantS: 13252 },
  { name: 'Charcoal Heather',  slug: 'charcoal-heather',  variantS: 11259 },
  { name: 'Vintage Black',     slug: 'vintage-black',     variantS: 20363 },
];

async function main() {
  console.log('═══ FIX: Re-upload corrected designs ═══\n');

  // Step 1: Upload corrected PNGs to Supabase Storage
  console.log('▶ Uploading corrected back design...');
  const backFile = readFileSync('/tmp/new-wave-back-final.png');
  await supabase.storage.from('designs').upload(
    `designs/${SLUG}/back-1800x2400.png`, backFile,
    { contentType: 'image/png', upsert: true }
  );
  console.log('  ✓ Back (stray lines removed)');

  console.log('▶ Uploading corrected sleeve design...');
  const sleeveFile = readFileSync('/tmp/sleeve-multicolor-fixed.png');
  await supabase.storage.from('designs').upload(
    `designs/${SLUG}/sleeve-multicolor-450x1800.png`, sleeveFile,
    { contentType: 'image/png', upsert: true }
  );
  console.log('  ✓ Sleeve (transparent background)');

  // Get public URLs
  const { data: backUrl } = supabase.storage.from('designs').getPublicUrl(`designs/${SLUG}/back-1800x2400.png`);
  const { data: sleeveUrl } = supabase.storage.from('designs').getPublicUrl(`designs/${SLUG}/sleeve-multicolor-450x1800.png`);
  const { data: chestUrl } = supabase.storage.from('designs').getPublicUrl(`designs/${SLUG}/chest-right-1800x2400.png`);

  console.log(`  Back URL: ${backUrl.publicUrl}`);
  console.log(`  Sleeve URL: ${sleeveUrl.publicUrl}`);

  // Step 2: Upload corrected files to Printful File Library
  console.log('\n▶ Uploading corrected designs to Printful File Library...');
  const ts = Date.now();

  const backPf = await pfFetch('/files', {
    method: 'POST',
    body: JSON.stringify({ url: `${backUrl.publicUrl}?v=${ts}`, filename: 'new-wave-back-v8-fixed.png' })
  });
  const backFileId = backPf.result.id;
  console.log(`  ✓ Back file_id: ${backFileId}`);
  await delay(3000);

  const sleevePf = await pfFetch('/files', {
    method: 'POST',
    body: JSON.stringify({ url: `${sleeveUrl.publicUrl}?v=${ts}`, filename: 'new-wave-sleeve-transparent.png' })
  });
  const sleeveFileId = sleevePf.result.id;
  console.log(`  ✓ Sleeve file_id: ${sleeveFileId}`);
  await delay(3000);

  // Step 3: Update Printful sync product — replace files on all variants
  console.log('\n▶ Updating Printful sync product variants with corrected files...');

  // Get current sync variants
  const productData = await pfFetch(`/store/products/${PF_PRODUCT_ID}`);
  const syncVariants = productData.result.sync_variants;
  // Get the existing chest file_id (unchanged)
  const chestFileId = syncVariants[0].files.find(f => f.type === 'default')?.id;
  console.log(`  Chest file_id (unchanged): ${chestFileId}`);

  for (const sv of syncVariants) {
    await delay(2000);
    try {
      await pfFetch(`/store/variants/${sv.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          files: [
            { type: 'default', id: chestFileId },
            { type: 'back', id: backFileId },
            { type: 'sleeve_left', id: sleeveFileId }
          ]
        })
      });
      process.stdout.write('.');
    } catch (err) {
      console.log(`\n  ⚠ Variant ${sv.id}: ${err.message}`);
    }
  }
  console.log(`\n  ✓ ${syncVariants.length} variants updated`);

  // Step 4: Wait for file processing, then get preview URLs for mockups
  console.log('\n▶ Waiting 15s for Printful file processing...');
  await delay(15000);

  // Get updated file preview URLs
  const updatedProduct = await pfFetch(`/store/products/${PF_PRODUCT_ID}`);
  const updatedFiles = updatedProduct.result.sync_variants[0].files;
  const chestPreview = updatedFiles.find(f => f.type === 'default')?.preview_url;
  const backPreview = updatedFiles.find(f => f.type === 'back')?.preview_url;
  const sleevePreview = updatedFiles.find(f => f.type === 'sleeve_left')?.preview_url;

  console.log(`  Front: ${chestPreview}`);
  console.log(`  Back: ${backPreview}`);
  console.log(`  Sleeve: ${sleevePreview}`);

  // Step 5: Regenerate mockups for all 4 colors
  console.log('\n═══ REGENERATING MOCKUPS ═══\n');

  const allMockups = [];

  for (const color of COLORS) {
    console.log(`▶ ${color.name} (variant ${color.variantS})...`);

    const taskRes = await pfFetch(`/mockup-generator/create-task/${CATALOG_ID}`, {
      method: 'POST',
      body: JSON.stringify({
        variant_ids: [color.variantS],
        format: 'png',
        width: 1000,
        option_groups: ['Ghost'],
        options: ['Front', 'Back', 'Left'],
        files: [
          {
            placement: 'front',
            image_url: chestPreview,
            position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 }
          },
          {
            placement: 'back',
            image_url: backPreview,
            position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 }
          },
          {
            placement: 'sleeve_left',
            image_url: sleevePreview,
            position: { area_width: 450, area_height: 1800, width: 450, height: 1800, top: 0, left: 0 }
          }
        ]
      })
    });

    const taskKey = taskRes.result?.task_key;
    if (!taskKey) { console.log(`  ✗ No task_key`); await delay(15000); continue; }
    console.log(`  Task: ${taskKey}`);

    let result = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      await delay(4000);
      const statusRes = await pfFetch(`/mockup-generator/task?task_key=${taskKey}`);
      if (statusRes.result?.status === 'completed') { result = statusRes.result; break; }
      if (statusRes.result?.status === 'failed') { console.log('  ✗ Failed'); break; }
      process.stdout.write('.');
    }

    if (result?.mockups?.length > 0) {
      // DEDUP: Only take first mockup per placement
      const seen = new Set();
      for (const mockup of result.mockups) {
        const viewName = mockup.placement === 'front' ? 'front'
          : mockup.placement === 'back' ? 'back'
          : mockup.placement === 'sleeve_left' ? 'sleeve'
          : mockup.placement;

        const key = `${color.slug}-${viewName}`;
        if (seen.has(key)) { console.log(`\n  ⚠ Skipping duplicate: ${key}`); continue; }
        seen.add(key);

        allMockups.push({
          color: color.name,
          slug: color.slug,
          view: viewName,
          url: mockup.mockup_url,
        });
      }
      console.log(`\n  ✓ ${seen.size} unique mockups`);
    }

    console.log('  Waiting 12s...');
    await delay(12000);
  }

  // Step 6: Upload mockups to Supabase
  console.log('\n═══ UPLOADING MOCKUPS ═══\n');
  const mockupUrls = [];

  for (const m of allMockups) {
    const filename = `${m.slug}-${m.view}.png`;
    const storagePath = `designs/mockups/${SLUG}/${filename}`;

    try {
      const imgRes = await fetch(m.url);
      if (!imgRes.ok) { console.log(`  ✗ Download: ${filename}`); continue; }
      const buffer = Buffer.from(await imgRes.arrayBuffer());

      const { error } = await supabase.storage.from('designs').upload(storagePath, buffer, {
        contentType: 'image/png', upsert: true
      });
      if (error) { console.log(`  ✗ Upload: ${filename}: ${error.message}`); continue; }

      const { data } = supabase.storage.from('designs').getPublicUrl(storagePath);
      mockupUrls.push({
        color: m.color, slug: m.slug, view: m.view, url: data.publicUrl,
        alt: m.view === 'sleeve' ? `New Wave Crewneck - ${m.color} - Sleeve` : `New Wave Crewneck - ${m.color}`
      });
      console.log(`  ✓ ${filename}`);
    } catch (err) {
      console.error(`  ✗ ${filename}:`, err.message);
    }
    await delay(300);
  }

  // Step 7: Update product images
  console.log('\n═══ UPDATING PRODUCT IMAGES ═══\n');
  const imgTs = Math.floor(Date.now() / 1000);

  const backs   = mockupUrls.filter(m => m.view === 'back');
  const fronts  = mockupUrls.filter(m => m.view === 'front');
  const sleeves = mockupUrls.filter(m => m.view === 'sleeve');

  const images = [...backs, ...fronts, ...sleeves].map(m => ({
    src: `${m.url}?v=${imgTs}`,
    alt: m.alt
  }));

  const { error } = await supabase.from('products').update({ images }).eq('id', PRODUCT_ID);
  if (error) { console.error('  ✗', error); return; }
  console.log(`  ✓ ${images.length} images (${backs.length} back + ${fronts.length} front + ${sleeves.length} sleeve)`);

  // Update variant image_url
  for (const color of COLORS) {
    const backMockup = backs.find(m => m.slug === color.slug);
    if (backMockup) {
      await supabase
        .from('product_variants')
        .update({ image_url: `${backMockup.url}?v=${imgTs}` })
        .eq('product_id', PRODUCT_ID)
        .eq('color', color.name);
      console.log(`  ✓ Variant images: ${color.name}`);
    }
  }

  console.log('\n═══ ALL FIXES APPLIED ═══');
  console.log(`  Mockups: ${mockupUrls.length} (${backs.length}B + ${fronts.length}F + ${sleeves.length}S)`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
