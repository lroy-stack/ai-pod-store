#!/usr/bin/env node
/**
 * Fix Vintage Black sleeve mockups for Nihilist Penguin + New Wave Crewneck
 * Root cause: Printful returns front as sleeve when requesting ['Front','Left'] together
 * Fix: Request ['Left'] alone to get the correct sleeve view
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
    console.log(`  Rate limited, waiting ${wait + 5}s...`);
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

const CATALOG_ID = 411;
const VINTAGE_BLACK_VARIANT = 20361; // L size — works better than S (20363)

const PRODUCTS = [
  {
    name: 'Nihilist Penguin',
    dbId: 'd9dc0857-6f55-473d-a629-dc08d64ef794',
    storagePath: 'mockups/nihilist-penguin',
    sleeveFile: {
      placement: 'sleeve_left',
      image_url: 'https://files.cdn.printful.com/files/248/248548075c8e2d9632cafc43cf7d7542_preview.png',
      position: { area_width: 450, area_height: 1800, width: 450, height: 1800, top: 0, left: 0 }
    }
  },
  {
    name: 'New Wave Crewneck',
    dbId: 'ebdaf049-3f59-49d8-85b7-09bc179ebb17',
    storagePath: 'designs/mockups/new-wave-crewneck',
    sleeveFile: {
      placement: 'sleeve_left',
      image_url: 'https://files.cdn.printful.com/files/92d/92dea0162f3d42b97d57d9d5ccd9ca94_preview.png',
      position: { area_width: 450, area_height: 1800, width: 450, height: 1800, top: 0, left: 0 }
    }
  }
];

async function fixProduct(product) {
  console.log(`\n=== ${product.name} ===\n`);

  // Step 1: Generate sleeve-only mockup
  console.log('Generating sleeve-only mockup (Left view only)...');
  const taskRes = await pfFetch(`/mockup-generator/create-task/${CATALOG_ID}`, {
    method: 'POST',
    body: JSON.stringify({
      variant_ids: [VINTAGE_BLACK_VARIANT],
      format: 'png',
      width: 1000,
      options: ['Left'],
      files: [product.sleeveFile]
    })
  });

  const taskKey = taskRes.result?.task_key;
  if (!taskKey) { console.log('  No task_key:', JSON.stringify(taskRes)); return false; }
  console.log(`  Task: ${taskKey}`);

  // Step 2: Poll
  let result = null;
  for (let i = 0; i < 30; i++) {
    await delay(4000);
    const s = await pfFetch(`/mockup-generator/task?task_key=${taskKey}`);
    if (s.result?.status === 'completed') { result = s.result; break; }
    if (s.result?.status === 'failed') { console.log('  FAILED'); return false; }
    process.stdout.write('.');
  }
  if (!result?.mockups?.length) { console.log('  No mockups'); return false; }
  console.log(`\n  Got ${result.mockups.length} mockup(s)`);

  const sleeveMockup = result.mockups.find(m => m.placement === 'sleeve_left');
  if (!sleeveMockup) { console.log('  No sleeve_left in response'); return false; }

  // Step 3: Download
  const imgRes = await fetch(sleeveMockup.mockup_url);
  if (!imgRes.ok) { console.log('  Download failed'); return false; }
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  console.log(`  Downloaded: ${buffer.length} bytes`);

  // Step 4: Upload to Supabase Storage
  const storagePath = `${product.storagePath}/vintage-black-sleeve.png`;
  const { error: uploadErr } = await supabase.storage.from('designs').upload(storagePath, buffer, {
    contentType: 'image/png', upsert: true
  });
  if (uploadErr) { console.log(`  Upload failed: ${uploadErr.message}`); return false; }

  const { data: publicUrl } = supabase.storage.from('designs').getPublicUrl(storagePath);
  const newSleeveUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;
  console.log(`  Uploaded: ${storagePath}`);

  // Step 5: Update product images array — replace only the Vintage Black sleeve entry
  const { data: productData } = await supabase.from('products').select('images').eq('id', product.dbId).single();
  if (!productData) { console.log('  Product not found'); return false; }

  const images = productData.images || [];
  let replaced = false;
  const updatedImages = images.map(img => {
    if (img.alt && img.alt.includes('Vintage Black') && img.alt.includes('Sleeve')) {
      replaced = true;
      return { ...img, src: newSleeveUrl };
    }
    return img;
  });

  if (!replaced) { console.log('  WARNING: No Vintage Black Sleeve image found in array'); return false; }

  const { error: updateErr } = await supabase.from('products').update({ images: updatedImages }).eq('id', product.dbId);
  if (updateErr) { console.log(`  DB update failed: ${updateErr.message}`); return false; }
  console.log('  Product images updated');

  return true;
}

async function main() {
  console.log('=== FIX VINTAGE BLACK SLEEVE MOCKUPS ===');
  console.log('Strategy: Request Left view ALONE (not combined with Front)\n');

  for (const product of PRODUCTS) {
    const ok = await fixProduct(product);
    console.log(ok ? `  OK: ${product.name}` : `  FAILED: ${product.name}`);
    await delay(12000);
  }

  console.log('\n=== DONE ===');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
