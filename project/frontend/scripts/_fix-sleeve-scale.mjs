#!/usr/bin/env node
/**
 * Fix sleeve scale — Upload correctly sized sleeve (20% = 360px width)
 * and regenerate all mockups
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
  console.log('═══ FIX: Sleeve scale (20% = 360px per branding rules) ═══\n');

  // 1. Upload corrected sleeve to Supabase
  console.log('▶ Uploading corrected sleeve (360px width, transparent)...');
  const sleeveFile = readFileSync('/tmp/sleeve-multicolor-correct.png');
  await supabase.storage.from('designs').upload(
    `designs/${SLUG}/sleeve-multicolor-450x1800.png`, sleeveFile,
    { contentType: 'image/png', upsert: true }
  );
  const { data: sleeveUrl } = supabase.storage.from('designs').getPublicUrl(`designs/${SLUG}/sleeve-multicolor-450x1800.png`);
  console.log(`  ✓ Sleeve: ${sleeveUrl.publicUrl}`);

  // 2. Upload to Printful File Library
  console.log('\n▶ Uploading to Printful File Library...');
  const ts = Date.now();
  const sleevePf = await pfFetch('/files', {
    method: 'POST',
    body: JSON.stringify({ url: `${sleeveUrl.publicUrl}?v=${ts}`, filename: 'new-wave-sleeve-20pct-360px.png' })
  });
  const sleeveFileId = sleevePf.result.id;
  console.log(`  ✓ Sleeve file_id: ${sleeveFileId}`);
  await delay(3000);

  // 3. Update all 24 variants with new sleeve file
  console.log('\n▶ Updating 24 Printful variants...');
  const productData = await pfFetch(`/store/products/${PF_PRODUCT_ID}`);
  const syncVariants = productData.result.sync_variants;
  const chestFileId = syncVariants[0].files.find(f => f.type === 'default')?.id;
  const backFileId = syncVariants[0].files.find(f => f.type === 'back')?.id;
  console.log(`  Chest: ${chestFileId}, Back: ${backFileId}, Sleeve: ${sleeveFileId}`);

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
      console.log(`\n  ⚠ ${sv.id}: ${err.message}`);
    }
  }
  console.log(`\n  ✓ ${syncVariants.length} variants updated`);

  // 4. Wait + get preview URLs
  console.log('\n▶ Waiting 15s for file processing...');
  await delay(15000);
  const updated = await pfFetch(`/store/products/${PF_PRODUCT_ID}`);
  const files = updated.result.sync_variants[0].files;
  const chestPreview = files.find(f => f.type === 'default')?.preview_url;
  const backPreview = files.find(f => f.type === 'back')?.preview_url;
  const sleevePreview = files.find(f => f.type === 'sleeve_left')?.preview_url;

  // 5. Regenerate all mockups
  console.log('\n═══ REGENERATING MOCKUPS ═══\n');
  const allMockups = [];

  for (const color of COLORS) {
    console.log(`▶ ${color.name}...`);
    const taskRes = await pfFetch(`/mockup-generator/create-task/${CATALOG_ID}`, {
      method: 'POST',
      body: JSON.stringify({
        variant_ids: [color.variantS],
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
    if (!taskKey) { console.log('  ✗ No task_key'); await delay(15000); continue; }

    let result = null;
    for (let i = 0; i < 30; i++) {
      await delay(4000);
      const s = await pfFetch(`/mockup-generator/task?task_key=${taskKey}`);
      if (s.result?.status === 'completed') { result = s.result; break; }
      if (s.result?.status === 'failed') { console.log('  ✗ Failed'); break; }
      process.stdout.write('.');
    }

    if (result?.mockups) {
      const seen = new Set();
      for (const m of result.mockups) {
        const view = m.placement === 'front' ? 'front' : m.placement === 'back' ? 'back'
          : m.placement === 'sleeve_left' ? 'sleeve' : m.placement;
        const key = `${color.slug}-${view}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allMockups.push({ color: color.name, slug: color.slug, view, url: m.mockup_url });
      }
      console.log(`\n  ✓ ${seen.size} mockups`);
    }
    console.log('  Waiting 12s...');
    await delay(12000);
  }

  // 6. Upload + update
  console.log('\n═══ UPLOADING MOCKUPS ═══\n');
  const mockupUrls = [];
  for (const m of allMockups) {
    const filename = `${m.slug}-${m.view}.png`;
    const path = `designs/mockups/${SLUG}/${filename}`;
    try {
      const r = await fetch(m.url);
      if (!r.ok) { console.log(`  ✗ ${filename}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      await supabase.storage.from('designs').upload(path, buf, { contentType: 'image/png', upsert: true });
      const { data } = supabase.storage.from('designs').getPublicUrl(path);
      mockupUrls.push({ color: m.color, slug: m.slug, view: m.view, url: data.publicUrl,
        alt: m.view === 'sleeve' ? `New Wave Crewneck - ${m.color} - Sleeve` : `New Wave Crewneck - ${m.color}` });
      console.log(`  ✓ ${filename}`);
    } catch (e) { console.error(`  ✗ ${filename}:`, e.message); }
    await delay(300);
  }

  const imgTs = Math.floor(Date.now() / 1000);
  const backs = mockupUrls.filter(m => m.view === 'back');
  const fronts = mockupUrls.filter(m => m.view === 'front');
  const sleeves = mockupUrls.filter(m => m.view === 'sleeve');
  const images = [...backs, ...fronts, ...sleeves].map(m => ({ src: `${m.url}?v=${imgTs}`, alt: m.alt }));

  await supabase.from('products').update({ images }).eq('id', PRODUCT_ID);
  console.log(`\n  ✓ ${images.length} images updated (${backs.length}B + ${fronts.length}F + ${sleeves.length}S)`);

  for (const color of COLORS) {
    const bm = backs.find(m => m.slug === color.slug);
    if (bm) {
      await supabase.from('product_variants')
        .update({ image_url: `${bm.url}?v=${imgTs}` })
        .eq('product_id', PRODUCT_ID).eq('color', color.name);
    }
  }
  console.log('  ✓ Variant images updated');
  console.log('\n═══ DONE — Sleeve at 20% scale (360px) ═══');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
