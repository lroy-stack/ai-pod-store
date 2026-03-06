#!/usr/bin/env node
/**
 * New Wave Crewneck — Mockup Generation (Step 7-9 only)
 * Uses catalog ID 411 with files[] per the Printful mockup-generator API
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
    return pfFetch(path, opts); // Retry
  }
  const json = await res.json();
  if (!res.ok) {
    console.error(`Printful ${res.status}:`, JSON.stringify(json, null, 2));
    throw new Error(`Printful API error: ${res.status}`);
  }
  return json;
}

// Product config
const PRODUCT_ID = 'ebdaf049-3f59-49d8-85b7-09bc179ebb17';
const SLUG = 'new-wave-crewneck';
const CATALOG_ID = 411;

// Design URLs from Printful CDN (already uploaded in step 3)
const DESIGN_URLS = {
  default:     'https://files.cdn.printful.com/files/d76/d760a23704d057021ff8cde23f6f22da_preview.png',
  back:        'https://files.cdn.printful.com/files/dda/dda2b085d74b3ea5a1308732693d0eab_preview.png',
  sleeve_left: 'https://files.cdn.printful.com/files/af7/af7d0576364489c30d90092488339672_preview.png',
};

const COLORS = [
  { name: 'Black',             slug: 'black',             variantS: 11254 },
  { name: 'Navy Blazer',       slug: 'navy-blazer',       variantS: 13252 },
  { name: 'Charcoal Heather',  slug: 'charcoal-heather',  variantS: 11259 },
  { name: 'Vintage Black',     slug: 'vintage-black',     variantS: 20363 },
];

async function main() {
  console.log('═══ MOCKUP GENERATION — New Wave Crewneck (M2480 Cat 411) ═══\n');

  const allMockups = [];

  for (const color of COLORS) {
    console.log(`\n▶ ${color.name} (variant ${color.variantS})...`);

    // Create mockup task using catalog ID (411), not sync product ID
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
            image_url: DESIGN_URLS.default,
            position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 }
          },
          {
            placement: 'back',
            image_url: DESIGN_URLS.back,
            position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 }
          },
          {
            placement: 'sleeve_left',
            image_url: DESIGN_URLS.sleeve_left,
            position: { area_width: 450, area_height: 1800, width: 450, height: 1800, top: 0, left: 0 }
          }
        ]
      })
    });

    const taskKey = taskRes.result?.task_key;
    if (!taskKey) {
      console.log(`  ✗ No task_key:`, JSON.stringify(taskRes));
      await delay(15000);
      continue;
    }
    console.log(`  Task key: ${taskKey}`);

    // Poll for result
    let result = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      await delay(4000);
      const statusRes = await pfFetch(`/mockup-generator/task?task_key=${taskKey}`);
      const status = statusRes.result?.status;
      if (status === 'completed') {
        result = statusRes.result;
        break;
      }
      if (status === 'failed') {
        console.log(`  ✗ Mockup generation failed`);
        break;
      }
      process.stdout.write('.');
    }

    if (result?.mockups?.length > 0) {
      const placements = result.mockups.map(m => m.placement).join(', ');
      console.log(`\n  ✓ ${result.mockups.length} mockups: ${placements}`);

      for (const mockup of result.mockups) {
        const viewName = mockup.placement === 'front' ? 'front'
          : mockup.placement === 'back' ? 'back'
          : mockup.placement === 'sleeve_left' ? 'sleeve'
          : mockup.placement;

        allMockups.push({
          color: color.name,
          slug: color.slug,
          view: viewName,
          url: mockup.mockup_url,
        });
      }
    } else {
      console.log(`  ✗ No mockups returned`);
    }

    // Wait between tasks to avoid rate limits
    console.log('  Waiting 12s before next color...');
    await delay(12000);
  }

  // Upload mockups to Supabase Storage
  console.log('\n\n═══ UPLOADING MOCKUPS TO SUPABASE ═══\n');
  const mockupUrls = [];

  for (const m of allMockups) {
    const filename = `${m.slug}-${m.view}.png`;
    const storagePath = `designs/mockups/${SLUG}/${filename}`;

    try {
      const imgRes = await fetch(m.url);
      if (!imgRes.ok) { console.log(`  ✗ Download failed: ${filename} (${imgRes.status})`); continue; }
      const buffer = Buffer.from(await imgRes.arrayBuffer());

      const { error } = await supabase.storage.from('designs').upload(storagePath, buffer, {
        contentType: 'image/png', upsert: true
      });
      if (error) { console.log(`  ✗ Upload failed: ${filename}:`, error.message); continue; }

      const { data } = supabase.storage.from('designs').getPublicUrl(storagePath);
      mockupUrls.push({
        color: m.color,
        slug: m.slug,
        view: m.view,
        url: data.publicUrl,
        alt: m.view === 'sleeve'
          ? `New Wave Crewneck - ${m.color} - Sleeve`
          : `New Wave Crewneck - ${m.color}`
      });
      console.log(`  ✓ ${filename}`);
    } catch (err) {
      console.error(`  ✗ ${filename}:`, err.message);
    }
    await delay(300);
  }

  // Update Supabase product images
  console.log('\n═══ UPDATING PRODUCT IMAGES ═══\n');
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
  if (error) { console.error('  ✗', error); return; }
  console.log(`  ✓ ${images.length} images (${backs.length} back + ${fronts.length} front + ${sleeves.length} sleeve)`);

  // Update variant image_url (back view for color toggles)
  for (const color of COLORS) {
    const backMockup = backs.find(m => m.slug === color.slug);
    if (backMockup) {
      const { error: vErr } = await supabase
        .from('product_variants')
        .update({ image_url: `${backMockup.url}?v=${ts}` })
        .eq('product_id', PRODUCT_ID)
        .eq('color', color.name);
      if (vErr) console.error(`  ✗ ${color.name}:`, vErr);
      else console.log(`  ✓ Variant images: ${color.name}`);
    }
  }

  console.log('\n═══ DONE ═══');
  console.log(`  Total mockups: ${mockupUrls.length}`);
  console.log(`  Product: ${PRODUCT_ID}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
